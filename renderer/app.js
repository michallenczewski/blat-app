// Blat — płótno tablicy. Jeden plik, bez frameworka i bez budowania, jak Gapa.
// Model: board = { v, name, items:[...], view:{x,y,z} }; element: { id, type:'image'|'note'|'frame'|'drawing', x,y,w,h, … }.
// Nazwy typów są te same co w webowym Blacie (obraz, notatka, ramka, rysunek), żeby kiedyś wymiana była prosta.
'use strict';
const $ = s => document.querySelector(s);
const isMac = api.platform === 'darwin';
const MOD = isMac ? '⌘' : 'Ctrl+';
const SHIFT = isMac ? '⇧' : 'Shift';
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
  ui: svg('<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.2h12"/>'),
  fs: svg('<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>') + svg('<path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5"/>'),
  set: svg('<path d="M2.5 5.5h11M2.5 10.5h11"/><circle cx="6" cy="5.5" r="1.8" fill="var(--bg)"/><circle cx="10.5" cy="10.5" r="1.8" fill="var(--bg)"/>'),
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
// motyw: jasny, ciemny albo jak w systemie (brak zapisu = jak w systemie); wybór w menu ustawień
const themeMode = () => { try { return localStorage.getItem('blatTheme') || 'system'; } catch (e) { return 'system'; } };
function setThemeMode(m) { try { if (m === 'system') localStorage.removeItem('blatTheme'); else localStorage.setItem('blatTheme', m); } catch (e) {} applyTheme(); }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themeMode() === 'system') applyTheme(); });
function applyTheme() {
  let t = themeMode();
  if (t === 'system') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  const cs = getComputedStyle(document.documentElement);
  // Windows: w trybie bez nawigacji przyciski okna leżą na płótnie, więc dostają jego kolor i niższy pasek
  const bareWin = isBare() && !isFs();
  if (api.chromeColors) api.chromeColors(cs.getPropertyValue(bareWin ? '--paper' : '--bg').trim(), cs.getPropertyValue('--text2').trim(), bareWin ? 32 : 52);
}

/* ---------- rysowanie elementów ---------- */
// widoczny obszar płótna (we współrzędnych świata) z zapasem pół ekranu z każdej strony; liczony raz na odświeżenie widoku
let viewRect = null;
function visRect() {
  if (viewRect) return viewRect;
  const v = board.view, w = main.clientWidth, h = main.clientHeight;
  return (viewRect = { x: (-v.x - w / 2) / v.z, y: (-v.y - h / 2) / v.z, w: 2 * w / v.z, h: 2 * h / v.z });
}
addEventListener('resize', () => { viewRect = null; if (typeof toolInd === 'function') toolInd(); });   // wskaźnik narzędzi, gdy w wąskim oknie część narzędzi znika
function imgSrc(it) {
  // na małym ekranowym rozmiarze wystarczy miniatura; pełny obraz dopiero po przybliżeniu (720 px fizycznych,
  // czyli na ekranie Retina już od 360 px) i tylko dla obrazów na ekranie albo tuż obok — reszta wraca do miniatury
  const px = Math.max(it.w, it.h) * board.view.z * DPR(), r = visRect();
  const seen = it.x < r.x + r.w && it.x + it.w > r.x && it.y < r.y + r.h && it.y + it.h > r.y;
  return api.imageUrl(board.name, px > 720 && seen && it.img.full ? it.img.full : it.img.thumb || it.img.full);
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
  if (it.type === 'note' && !el.isContentEditable && el.textContent !== (it.text || '')) el.textContent = it.text || '';
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
  for (const it of board.items) drawItem(it);   // ramki (z licznikiem zawartości) też tu
  main.classList.toggle('isempty', board.items.length === 0);
  updateGbox();
}
function frameCounts() { for (const f of board.items) if (f.type === 'frame') drawItem(f); }
function applyView() {
  const v = board.view; viewRect = null;
  world.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.z + ')';
  $('#zoomPct').textContent = Math.round(v.z * 100) + '%';
  clearTimeout(applyView.t);
  applyView.t = setTimeout(() => { for (const it of board.items) if (it.type === 'image' || it.type === 'drawing' || sel.has(it.id)) drawItem(it); updateGbox(); }, 160);   // podmiana miniatura/pełny obraz po zakończeniu przybliżania
}

/* ---------- zapis, cofanie ---------- */
function snapshot() { undoStack.push(JSON.stringify(board.items)); if (undoStack.length > 120) undoStack.shift(); redoStack.length = 0; }
function changed() {
  dirty = true; $('#saved').textContent = _t('zapisuję…');
  clearTimeout(saveT); saveT = setTimeout(saveNow, 700);
  main.classList.toggle('isempty', board.items.length === 0);
}
// Zapisy idą po kolei (nigdy dwa naraz). Nieudany zapis ponawia się sam po 2 s.
let saving = null;
// force: zapis w trakcie zmiany nazwy, wołany przez samą zmianę nazwy; inne zapisy w tym czasie czekają chwilę
async function saveNow(force) {
  if (renaming && !force) { if (dirty) { clearTimeout(saveT); saveT = setTimeout(saveNow, 300); } return; }
  while (saving) await saving;
  if (!board || !dirty) return;
  clearTimeout(saveT); dirty = false;
  const b = board;
  saving = (async () => {
    try { const r = await api.boardSave(b.name, b); if (board === b) $('#saved').textContent = _t('zapisane'); boardRow(r && r.row); }
    catch (e) {
      errors.push(e.message);
      // folder blatu zniknął (kosz, Finder, Eksplorator, odłączony dysk, OneDrive): zmiany zostają w oknie,
      // napis mówi o tym wprost, a zapis próbuje dalej co 10 s — gdy folder wróci, wszystko się zapisze
      const gone = /nie istnieje/.test(e.message);
      if (gone) boardsCache = boardsCache.filter(x => x.name !== b.name);   // przejście na inny blat nie jest blokowane
      if (board === b) { dirty = true; $('#saved').textContent = gone ? _t('Folder blatu zniknął — zmiany nie są zapisywane') : _t('nie udało się zapisać'); clearTimeout(saveT); saveT = setTimeout(saveNow, gone ? 10000 : 2000); }
    }
  })();
  try { await saving; } finally { saving = null; }
}
const byName = n => boardsCache.some(b => b.name === n);
// po zapisie odświeżamy tylko wiersz bieżącego blatu (bez czytania wszystkich blatów z dysku)
function boardRow(row) {
  if (!row) return;
  const li = [...$('#boards').children].find(l => l.dataset.name === row.name);
  if (!li) { refreshBoards(); return; }
  const c = boardsCache.find(b => b.name === row.name); if (c) Object.assign(c, row);
  li.querySelector('small').textContent = row.count;
  const th = li.querySelector('.th'), key = row.thumbs.join('|');
  if (th.dataset.k !== key) { th.dataset.k = key; th.innerHTML = ''; for (const t of row.thumbs) { const i = document.createElement('i'); i.style.backgroundImage = 'url("' + api.imageUrl(row.name, t) + '")'; th.appendChild(i); } }
  if (li !== li.parentNode.firstElementChild) li.parentNode.prepend(li);   // ostatnio zmieniony na górze, jak po odświeżeniu
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
    const li = document.createElement('li'); li.className = board && b.name === board.name ? 'on' : ''; li.dataset.name = b.name;
    const th = document.createElement('span'); th.className = 'th'; th.dataset.k = b.thumbs.join('|');
    for (const t of b.thumbs) { const i = document.createElement('i'); i.style.backgroundImage = 'url("' + api.imageUrl(b.name, t) + '")'; th.appendChild(i); }
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = b.name;
    const sm = document.createElement('small'); sm.textContent = b.count;
    li.append(th, nm, sm);
    li.onclick = () => openBoard(b.name);
    li.oncontextmenu = e => { e.preventDefault(); showMenu(e.clientX, e.clientY, [
      [_t('Zmień nazwę…'), () => { openBoard(b.name).then(() => { if (board && board.name === b.name) renameStart(); }); }],
      [_t(isMac ? 'Pokaż w Finderze' : 'Pokaż w Eksploratorze'), () => api.boardReveal(b.name)],
      '-',
      [_t('Przenieś do kosza'), () => trashBoard(b.name), 'warn']]); };
    ul.appendChild(li);
  }
  return r;
}
async function openBoard(name) {
  while (renaming) await renaming;
  clearTimeout(viewT); if (viewT) { viewT = 0; dirty = true; }   // przesunięty widok zapisujemy od razu
  await saveNow();
  if (dirty && board && byName(board.name)) { tip(_t('Nie udało się zapisać — spróbuję jeszcze raz')); return; }
  if (dirty && board) tip(_t('Zmiany w blacie bez folderu nie zostały zapisane') + ': ' + board.name);   // folder blatu zniknął
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
async function newBoard() { while (renaming) await renaming; await saveNow(); const b = await api.boardNew(_t('Nowy blat')); setBoard(b); renameStart(); }
async function trashBoard(name) {
  while (renaming) await renaming;
  if (board && board.name === name) { dirty = false; clearTimeout(saveT); clearTimeout(viewT); viewT = 0; }
  if (!(await api.boardTrash(name))) { tip(_t('Nie udało się przenieść blatu do kosza')); return; }
  const r = await refreshBoards();
  if (!board || board.name === name) { if (r.boards[0]) openBoard(r.boards[0].name); else newBoard(); }
}
// pliki obrazów w trakcie dodawania: jeszcze ich nie ma w elementach blatu, a nie wolno ich skasować
const pending = new Set();
function pruneImages(b) {
  const keep = [...pending].filter(k => k.startsWith(b.name + '/')).map(k => k.slice(b.name.length + 1));
  for (const i of [...b.items, ...(clip && clip.board === b.name ? clip.items : [])]) if (i.img) { if (i.img.full) keep.push(i.img.full); if (i.img.thumb) keep.push(i.img.thumb); }   // wycięte obrazy czekają w schowku
  api.imagesPrune(b.name, keep);
}
// Zmiana nazwy dotyczy blatu otwartego w chwili jej rozpoczęcia — nawet jeśli w trakcie kliknięto inny blat.
// Kolejne zmiany nazwy czekają na poprzednią; przełączenie blatu, nowy blat, kosz i zamykanie też.
let renaming = null;
function renameBoard(v) {
  const prev = renaming;
  const run = async () => {
    if (prev) await prev;
    const b = board, from = b.name;
    if (v === from) return from;
    clearTimeout(viewT); if (viewT) { viewT = 0; dirty = true; }
    await saveNow(true);
    let n; try { n = await api.boardRename(from, v); } catch (e) { errors.push(e.message); tip(_t('Nie udało się zmienić nazwy blatu')); return null; }
    if (!n) { tip(_t('Blat o tej nazwie już istnieje')); return null; }
    if (clip && clip.board === from) clip.board = n;
    b.name = n;
    if (board === b) { $('#bname').textContent = n; document.title = n + ' — Blat'; dirty = true; await saveNow(true); drawAll(); }
    refreshBoards();
    return n;
  };
  const p = run(), q = p.catch(() => null).finally(() => { if (renaming === q) renaming = null; });
  renaming = q;
  return p;
}
function renameStart() {
  const b = $('#bname'), inp = document.createElement('input'); inp.value = board.name; b.replaceWith(inp); inp.focus(); inp.select();
  const done = ok => {
    if (!inp.isConnected) return;
    const v = inp.value.trim(); inp.replaceWith(b);
    if (ok && v && v !== board.name) renameBoard(v);
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
async function storeImage(blob, name, bname) {
  const bmp = await createImageBitmap(blob);
  const id = uid(), keepOrig = Math.max(bmp.width, bmp.height) <= MAXFULL && /^image\/(jpeg|png|webp|gif)$/.test(blob.type);
  const ext = keepOrig ? ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[blob.type] : 'webp';
  const full = keepOrig ? blob : await toBlob(bmp, MAXFULL, 'image/webp', 0.9);
  const thumb = Math.max(bmp.width, bmp.height) > THUMB ? await toBlob(bmp, THUMB, 'image/webp', 0.85) : null;
  const img = { full: id + '.' + ext, thumb: thumb ? id + '-m.webp' : null, w: bmp.width, h: bmp.height, src: name || '' };
  bmp.close();
  for (const f of [img.full, img.thumb]) if (f) pending.add(bname + '/' + f);
  await api.imagePut(bname, img.full, await full.arrayBuffer());
  if (thumb) await api.imagePut(bname, img.thumb, await thumb.arrayBuffer());
  return img;
}
// kilka obrazów naraz: układamy je w rząd od wskazanego punktu, o jednakowej wysokości
// Obrazy trafiają zawsze do blatu, na którym zaczął się import — także jeśli w trakcie przełączono blat.
async function addImages(blobs, at) {
  if (!blobs.length) return [];
  const target = board, p = at || centerWorld();
  tip(blobs.length > 1 ? _t('Dodaję obrazy…') + ' ' + blobs.length : _t('Dodaję obraz…'));
  const H = Math.round(260 / target.view.z);   // nowe obrazy mają ok. 260 px wysokości na ekranie
  const made = [];
  try {
    for (const [blob, name] of blobs) {
      try { made.push(await storeImage(blob, name, target.name)); }
      catch (e) { if (!byName(target.name) && boardsCache.length) break; tip(_t('Tego formatu Blat jeszcze nie czyta') + (name ? ': ' + name : '')); }
    }
    if (!made.length) return [];
    const items = placeImages(target, made, p, H);
    const cur = board && board.name === target.name ? board : null;   // także gdy w trakcie wrócono na ten blat
    if (cur) {
      snapshot(); cur.items.push(...items); sel = new Set(items.map(i => i.id)); drawAll(); changed();
      tip(items.length > 1 ? _t('Dodane obrazy') + ': ' + items.length : _t('Dodany obraz'));
    } else {
      // blat zmieniono w trakcie: dopisujemy do tamtego blatu (wczytanego na nowo, bo mógł się zmienić) i zapisujemy
      // dopisuje proces główny, w kolejce zapisów tamtego blatu (bez zmiany „ostatnio otwartego”)
      try { await api.boardAppend(target.name, items); refreshBoards(); tip(_t('Obrazy dodane do blatu') + ' „' + target.name + '”'); }
      catch (e) { errors.push(e.message); tip(_t('Nie udało się dodać obrazów do blatu') + ' „' + target.name + '”'); return []; }
    }
    return items;
  } finally { for (const img of made) for (const f of [img.full, img.thumb]) pending.delete(target.name + '/' + f); }
}
function placeImages(target, made, p, H) {
  const top = Math.max(0, ...target.items.map(i => i.z || 0)) + 1;
  let x = p.x, y = p.y - H / 2;
  const rowW = Math.max(900, Math.sqrt(made.length) * H * 1.6);
  const items = [];
  made.forEach((img, k) => {
    const w = Math.round(H * img.w / img.h);
    if (x - p.x > rowW) { x = p.x; y += H + 16; }
    items.push({ id: uid(), type: 'image', x: Math.round(x), y: Math.round(y), w, h: Math.round(H), z: top + k, img }); x += w + 16;
  });
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
  el.contentEditable = 'plaintext-only'; el.focus();   // wklejony tekst bez formatowania i obrazków
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  const done = () => {
    el.contentEditable = 'false'; el.removeEventListener('blur', done);
    const t = el.innerText.replace(/\n+$/, '');
    if (!t.trim()) { if (it.text) snapshot(); board.items = board.items.filter(i => i !== it); sel.delete(it.id); drawAll(); changed(); return; }   // notatka z tekstem: usunięcie da się cofnąć
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


/* ---------- wyrównywanie i rozkładanie (menu przycisku układania, prawy przycisk, skróty ⌥ / Alt) ---------- */
// Jednostki: ramka razem z zawartością albo pojedynczy obraz lub notatka; kreski mazaka jadą za swoim obrazem.
function alignUnits() {
  const list = selItems().filter(i => i.type !== 'drawing'), used = new Set(), units = [];
  for (const f of list.filter(i => i.type === 'frame')) {
    const items = [f, ...board.items.filter(o => o.type !== 'frame' && o.type !== 'drawing' && !used.has(o.id) && inside(o, f))];
    items.forEach(o => used.add(o.id)); units.push({ b: f, items });
  }
  for (const i of list) if (i.type !== 'frame' && !used.has(i.id)) units.push({ b: i, items: [i] });
  return units;
}
function shake(msg) { const b = $('#arrangeBtn'); b.classList.remove('tak', 'nie'); void b.offsetWidth; b.classList.add('nie'); if (msg) tip(msg); }
function nod() { const b = $('#arrangeBtn'); b.classList.remove('tak', 'nie'); void b.offsetWidth; b.classList.add('tak'); }
// Wspólna wysokość (szerokość): mediana zaznaczonych, proporcje obrazów zostają. Lewy górny róg każdego zostaje,
// a jeśli elementy stały w rzędzie (kolumnie), zostają też odstępy między nimi — nic na siebie nie najeżdża.
function sameSize(units, dim) {
  const P = dim === 'h' ? 'x' : 'y', S = dim === 'h' ? 'w' : 'h', T = dim;
  const us = units.filter(u => u.items.length === 1 && (u.b.type === 'image' || (dim === 'w' && u.b.type === 'note')));
  if (us.length < 2) return false;
  const vals = us.map(u => u.b[T]).sort((a, c) => a - c), V = Math.round(vals[Math.floor((vals.length - 1) / 2)]);
  us.sort((p, q) => p.b[P] - q.b[P]);
  const o = us.map(u => ({ x: u.b.x, y: u.b.y, w: u.b.w, h: u.b.h }));
  const row = us.every((u, i) => !i || o[i][P] >= o[i - 1][P] + o[i - 1][S]);   // stoją jeden za drugim bez nachodzenia
  us.forEach((u, i) => {
    const it = u.b, k = V / it[T];
    if (it.type === 'note') it.w = V; else { it.w = Math.round(it.w * k); it.h = Math.round(it.h * k); }
    if (row && i) it[P] = Math.round(us[i - 1].b[P] + us[i - 1].b[S] + (o[i][P] - o[i - 1][P] - o[i - 1][S]));
    followParent(it, o[i]);
  });
  return true;
}
function alignSel(how) {
  const units = alignUnits();
  if (units.length < 2) { shake(_t('Zaznacz co najmniej dwa elementy')); return; }
  if ((how === 'dx' || how === 'dy') && units.length < 3) { shake(_t('Równe odstępy potrzebują co najmniej trzech elementów')); return; }
  const moved = units.flatMap(u => u.items.flatMap(i => [i, ...kidsOf(i.id)])), before = new Map(moved.map(i => [i.id, { x: i.x, y: i.y, w: i.w, h: i.h }]));
  const all = bbox(units.map(u => u.b));
  snapshot();
  const move = (u, dx, dy) => { dx = Math.round(dx); dy = Math.round(dy); if (!dx && !dy) return; for (const i of u.items) { const o = { x: i.x, y: i.y, w: i.w, h: i.h }; i.x += dx; i.y += dy; if (i.type === 'image') followParent(i, o); } };
  if (how === 'left') units.forEach(u => move(u, all.x - u.b.x, 0));
  else if (how === 'right') units.forEach(u => move(u, all.x + all.w - u.b.x - u.b.w, 0));
  else if (how === 'cx') units.forEach(u => move(u, all.x + all.w / 2 - u.b.x - u.b.w / 2, 0));
  else if (how === 'top') units.forEach(u => move(u, 0, all.y - u.b.y));
  else if (how === 'bottom') units.forEach(u => move(u, 0, all.y + all.h - u.b.y - u.b.h));
  else if (how === 'cy') units.forEach(u => move(u, 0, all.y + all.h / 2 - u.b.y - u.b.h / 2));
  else if (how === 'dx' || how === 'dy') {
    // skrajne elementy zostają, środkowe dostają równe odstępy
    const P = how === 'dx' ? 'x' : 'y', S = how === 'dx' ? 'w' : 'h';
    const us = units.slice().sort((p, q) => p.b[P] + p.b[S] / 2 - q.b[P] - q.b[S] / 2);
    const first = us[0].b, last = us[us.length - 1].b, span = last[P] + last[S] - first[P];
    const gap = (span - us.reduce((t, u) => t + u.b[S], 0)) / (us.length - 1);
    let at = first[P] + first[S] + gap;
    for (const u of us.slice(1, -1)) { const d = at - u.b[P]; move(u, P === 'x' ? d : 0, P === 'y' ? d : 0); at += u.b[S] + gap; }
  }
  else if (how === 'sameH' || how === 'sameW') { if (!sameSize(units, how === 'sameH' ? 'h' : 'w')) { undoStack.pop(); shake(_t('Zaznacz co najmniej dwa obrazy')); return; } }
  drawAll(); changed(); glide(moved, before); nod();
}
const ALT = isMac ? '⌥' : 'Alt+', ALTSH = isMac ? '⌥⇧' : 'Alt+Shift+';
function arrangeRows() {
  return [
    [_t('Ułóż w rzędach'), arrange, 'A'],
    '-',
    [_t('Wspólna wysokość'), () => alignSel('sameH')],
    [_t('Wspólna szerokość'), () => alignSel('sameW')],
    '-',
    [_t('Wyrównaj do lewej'), () => alignSel('left'), ALT + 'A'],
    [_t('Wyrównaj do osi pionowej'), () => alignSel('cx'), ALT + 'V'],
    [_t('Wyrównaj do prawej'), () => alignSel('right'), ALT + 'D'],
    [_t('Wyrównaj do góry'), () => alignSel('top'), ALT + 'W'],
    [_t('Wyrównaj do osi poziomej'), () => alignSel('cy'), ALT + 'H'],
    [_t('Wyrównaj do dołu'), () => alignSel('bottom'), ALT + 'S'],
    '-',
    [_t('Równe odstępy w poziomie'), () => alignSel('dx'), ALTSH + 'H'],
    [_t('Równe odstępy w pionie'), () => alignSel('dy'), ALTSH + 'V'],
  ];
}
function showArrangeMenu(x, y) {
  if (x != null) { showMenu(x, y, arrangeRows()); return; }
  const r = $('#arrangeBtn').getBoundingClientRect(); showMenu(r.left, r.bottom + 6, arrangeRows());
  const m = $('#menu'); m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px'; m.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8)) + 'px';
}

/* ---------- przyciąganie (jak w Blacie w przeglądarce: snapMove, spacingSnap, resizeBox) ---------- */
// Do krawędzi i środków innych elementów na ekranie oraz do równych odstępów; ⌥ / Alt w trakcie przeciągania wyłącza.
const SNAP_PX = 6;   // próg na ekranie
function guideLayer() { let g = $('#guides'); if (!g) { g = document.createElement('div'); g.id = 'guides'; world.appendChild(g); } return g; }
function clearGuides() { const g = $('#guides'); if (g) g.innerHTML = ''; }
// Linie i odstępy innych elementów liczymy raz na przeciąganie (w trakcie się nie zmieniają) — przy setkach
// obrazów na ekranie liczenie odstępów co ruch myszy byłoby za wolne.
let snapCache = null;
function snapTargets(exclude) {
  if (snapCache && snapCache.ex === exclude && snapCache.z === board.view.z && snapCache.vx === board.view.x && snapCache.vy === board.view.y) return snapCache.t;
  const v = board.view, x0 = -v.x / v.z, y0 = -v.y / v.z, x1 = x0 + main.clientWidth / v.z, y1 = y0 + main.clientHeight / v.z;
  const xs = [], ys = [], boxes = [];
  for (const o of board.items) {
    if (exclude.has(o.id) || o.type === 'drawing') continue;
    if (o.x > x1 || o.x + o.w < x0 || o.y > y1 || o.y + o.h < y0) continue;   // tylko to, co widać
    xs.push({ v: o.x, b: o }, { v: o.x + o.w / 2, b: o }, { v: o.x + o.w, b: o });
    ys.push({ v: o.y, b: o }, { v: o.y + o.h / 2, b: o }, { v: o.y + o.h, b: o });
    if (o.type !== 'frame') boxes.push(o);
  }
  const t = { xs, ys, boxes };
  snapCache = { ex: exclude, z: v.z, vx: v.x, vy: v.y, t };
  return t;
}
function bestSnap(ours, targets, th) {
  let best = null;
  for (const o of ours) for (const t of targets) { const d = t.v - o; if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, v: t.v, b: t.b }; }
  return best;
}
// taki sam odstęp jak między innymi elementami w rzędzie (kolumnie) albo dokładnie pośrodku między sąsiadami
function spacingSnap(axis, box, boxes, th) {
  const P = axis, S = axis === 'x' ? 'w' : 'h', Q = axis === 'x' ? 'y' : 'x', T = axis === 'x' ? 'h' : 'w';
  const overlap = (a, b) => a[Q] < b[Q] + b[T] && a[Q] + a[T] > b[Q];
  const memo = boxes.gaps || (boxes.gaps = {});
  let gaps = memo[axis];
  if (!gaps) {
    gaps = memo[axis] = [];
    for (const a of boxes) {
      let best = null;
      for (const b of boxes) { if (a === b || !overlap(a, b) || b[P] < a[P] + a[S]) continue; const g = b[P] - (a[P] + a[S]); if (!best || g < best.g) best = { g, a, b }; }
      if (best && best.g > 0 && best.g < 2000) gaps.push(best);
    }
  }
  const line = boxes.filter(o => overlap(o, box)), c = box[P] + box[S] / 2;
  const before = line.filter(o => o[P] + o[S] <= c).sort((a, b) => b[P] + b[S] - (a[P] + a[S]))[0];
  const after = line.filter(o => o[P] >= c).sort((a, b) => a[P] - b[P])[0];
  let res = null;
  const consider = (target, info) => { const d = target - box[P]; if (Math.abs(d) <= th && (!res || Math.abs(d) < Math.abs(res.d))) res = { d, ...info }; };
  if (before && after) consider((before[P] + before[S] + after[P] - box[S]) / 2, { kind: 'center', before, after });
  for (const gp of gaps) {
    if (before) consider(before[P] + before[S] + gp.g, { kind: 'gap', n: before, side: 'before', gp });
    if (after) consider(after[P] - gp.g - box[S], { kind: 'gap', n: after, side: 'after', gp });
  }
  return res;
}
function drawGuide(dir, v, a, b) {
  const g = document.createElement('div'), pad = 12 / board.view.z, t = 1 / board.view.z;
  g.className = 'gd';
  if (dir === 'v') { const y0 = Math.min(a.y, b.y) - pad, y1 = Math.max(a.y + a.h, b.y + b.h) + pad; Object.assign(g.style, { left: v - t / 2 + 'px', top: y0 + 'px', width: t + 'px', height: y1 - y0 + 'px' }); }
  else { const x0 = Math.min(a.x, b.x) - pad, x1 = Math.max(a.x + a.w, b.x + b.w) + pad; Object.assign(g.style, { top: v - t / 2 + 'px', left: x0 + 'px', height: t + 'px', width: x1 - x0 + 'px' }); }
  guideLayer().appendChild(g);
}
// odcinek z kreseczkami na końcach pokazujący odstęp między a i b (a przed b)
function drawGap(axis, a, b) {
  const g = document.createElement('div'), t = 1 / board.view.z; g.className = 'gd gap ' + (axis === 'x' ? 'h' : 'v'); g.style.setProperty('--t', t + 'px');
  if (axis === 'x') { const y = (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2, x0 = a.x + a.w; Object.assign(g.style, { left: x0 + 'px', top: y - t / 2 + 'px', width: b.x - x0 + 'px', height: t + 'px' }); }
  else { const x = (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2, y0 = a.y + a.h; Object.assign(g.style, { top: y0 + 'px', left: x - t / 2 + 'px', height: b.y - y0 + 'px', width: t + 'px' }); }
  guideLayer().appendChild(g);
}
function drawSpacing(axis, s, box) {
  if (s.kind === 'center') { drawGap(axis, s.before, box); drawGap(axis, box, s.after); }
  else { if (s.side === 'before') drawGap(axis, s.n, box); else drawGap(axis, box, s.n); drawGap(axis, s.gp.a, s.gp.b); }
}
function snapMove(box, exclude, noSnap) {
  clearGuides();
  if (noSnap) return { ...box, x: Math.round(box.x), y: Math.round(box.y) };
  const th = SNAP_PX / board.view.z, { xs, ys, boxes } = snapTargets(exclude);
  let { x, y } = box;
  const ax = bestSnap([x, x + box.w / 2, x + box.w], xs, th), ay = bestSnap([y, y + box.h / 2, y + box.h], ys, th);
  const gx = spacingSnap('x', box, boxes, th);
  const useGx = gx && (!ax || Math.abs(gx.d) < Math.abs(ax.d) - .01);   // wyrównanie krawędzi wygrywa przy remisie
  if (useGx) x += gx.d; else if (ax) x += ax.d;
  const gy = spacingSnap('y', { ...box, x }, boxes, th);
  const useGy = gy && (!ay || Math.abs(gy.d) < Math.abs(ay.d) - .01);
  if (useGy) y += gy.d; else if (ay) y += ay.d;
  const out = { ...box, x: Math.round(x), y: Math.round(y) };
  if (useGx) drawSpacing('x', gx, out); else if (ax) drawGuide('v', ax.v, out, ax.b);
  if (useGy) drawSpacing('y', gy, out); else if (ay) drawGuide('h', ay.v, out, ay.b);
  return out;
}
// zmiana rozmiaru za prawy dolny róg: lewy górny stoi, prawy dolny przyciąga się do linii innych elementów
function resizeBox(b0, mx, my, exclude, keepRatio, minW, noSnap) {
  clearGuides();
  let sx = null, sy = null;
  if (!noSnap) {
    const th = SNAP_PX / board.view.z, { xs, ys } = snapTargets(exclude);
    sx = bestSnap([mx], xs, th); sy = bestSnap([my], ys, th);
    if (sx) mx += sx.d; if (sy) my += sy.d;
  }
  let w = Math.max(minW, mx - b0.x), h = Math.max(minW, my - b0.y);
  if (keepRatio) {
    const r = b0.w / b0.h;
    if (sx && (!sy || Math.abs(sx.d) <= Math.abs(sy.d))) h = w / r;
    else if (sy) w = h * r;
    else { const k = Math.max(w / b0.w, h / b0.h); w = b0.w * k; h = b0.h * k; }
    if (w < minW) { w = minW; h = w / r; }
  }
  const out = { x: b0.x, y: b0.y, w, h };
  if (sx && Math.abs(sx.v - (out.x + w)) < .75) drawGuide('v', sx.v, out, sx.b);
  if (sy && Math.abs(sy.v - (out.y + h)) < .75) drawGuide('h', sy.v, out, sy.b);
  return out;
}
// wspólna ramka kilku zaznaczonych, z uchwytem do skalowania wszystkich naraz
function updateGbox() {
  let g = $('#gbox');
  const list = drag && drag.kind === 'gresize' ? null : selItems().filter(i => i.type !== 'drawing');
  if (list && (list.length < 2 || tool !== 'select')) { if (g) g.style.display = 'none'; return; }
  if (!g) { g = document.createElement('div'); g.id = 'gbox'; g.innerHTML = '<span class="hd br"></span>'; world.appendChild(g); }
  const b = list ? bbox(list) : drag.cur, k = 1 / board.view.z;
  Object.assign(g.style, { display: 'block', left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', zIndex: 100000 });
  g.style.setProperty('--k', k); const hd = g.firstChild; hd.style.transform = 'scale(' + k + ')'; hd.style.transformOrigin = '100% 100%';
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
function changedView() { clearTimeout(viewT); viewT = setTimeout(() => { viewT = 0; dirty = true; saveNow(); }, 1500); }   // widok zapisujemy po cichu

/* ---------- myszka ---------- */
let drag = null, spaceDown = false;
main.addEventListener('pointerdown', e => {
  if (e.target.closest('input')) return;
  const it = e.target.closest('.it'), item = it && byId(it.dataset.id);
  if (item && item.type === 'note' && els.get(item.id).isContentEditable) return;
  main.focus({ preventScroll: true });
  hideMenu();
  const w = toWorld(e.clientX, e.clientY);
  if (e.button === 1 || spaceDown || (e.button === 0 && e.altKey && !item && !e.target.classList.contains('hd'))) {   // ⌥ na uchwycie: skalowanie bez przyciągania
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
  else if (tool === 'frame') { const redo0 = redoStack.slice(); snapshot(); const f = { id: uid(), type: 'frame', x: w.x, y: w.y, w: 1, h: 1, name: _t('Ramka'), z: 0 }; board.items.push(f); sel = new Set([f.id]); drawAll(); drag = { kind: 'newframe', f, ox: w.x, oy: w.y, redo0 }; }
  else if (e.target.classList.contains('hd') && e.target.closest('#gbox')) {
    // skalowanie kilku zaznaczonych naraz: wszystko (z zawartością ramek i kreskami) rośnie od lewego górnego rogu
    const ms = movingSet(), list = [...ms].map(byId).filter(Boolean), b0 = bbox(list.filter(i => i.type !== 'drawing'));
    drag = { kind: 'gresize', moved: false, b0, cur: b0, gx: b0.x + b0.w - w.x, gy: b0.y + b0.h - w.y, ms, start: list.map(o => [o, o.x, o.y, o.w, o.h]) };
  }
  else if (e.target.classList.contains('hd') && item) {
    drag = { kind: 'resize', moved: false, item, ox: w.x, oy: w.y, w0: item.w, h0: item.h, ratio: item.type === 'image' ? item.w / item.h : 0,
      gx: item.x + item.w - w.x, gy: item.y + item.h - w.y, kids: kidsOf(item.id).map(c => [c, c.x, c.y, c.w, c.h]) };
  } else if (item) {
    if (e.shiftKey || e.metaKey || e.ctrlKey) { sel.has(item.id) ? sel.delete(item.id) : sel.add(item.id); }
    else if (!sel.has(item.id)) sel = new Set([item.id]);
    // ramka przesuwa się razem z tym, co w niej leży
    const moving = movingSet(), start = [...moving].map(id => { const o = byId(id); return [o, o.x, o.y]; });
    drag = { kind: 'move', ox: w.x, oy: w.y, start, moved: false, moving, box0: bbox(start.map(s => s[0]).filter(o => o.type !== 'drawing')) };
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
    let dx = w.x - drag.ox, dy = w.y - drag.oy;
    if (!drag.moved && Math.hypot(dx, dy) * board.view.z < 3) return;
    if (!drag.moved) { drag.moved = true; snapshot(); }
    const b = snapMove({ ...drag.box0, x: drag.box0.x + dx, y: drag.box0.y + dy }, drag.moving, e.altKey);   // ⌥ / Alt: bez przyciągania
    dx = b.x - drag.box0.x; dy = b.y - drag.box0.y;
    for (const [o, x, y] of drag.start) { o.x = Math.round(x + dx); o.y = Math.round(y + dy); drawItem(o); }
    updateGbox();
  } else if (drag.kind === 'gresize') {
    if (!drag.moved) { drag.moved = true; snapshot(); }
    const b0 = drag.b0, nb = resizeBox(b0, w.x + drag.gx, w.y + drag.gy, drag.ms, true, 24, e.altKey), k = nb.w / b0.w;
    drag.cur = nb;
    for (const [o, x, y, ow, oh] of drag.start) { o.x = b0.x + (x - b0.x) * k; o.y = b0.y + (y - b0.y) * k; o.w = ow * k; if (o.type !== 'note') o.h = oh * k; drawItem(o); }
    updateGbox();
  } else if (drag.kind === 'resize') {
    if (!drag.moved) { drag.moved = true; snapshot(); }   // krok cofania dopiero przy prawdziwej zmianie rozmiaru
    const it = drag.item, nb = resizeBox({ x: it.x, y: it.y, w: drag.w0, h: drag.h0 }, w.x + drag.gx, w.y + drag.gy, new Set([it.id, ...drag.kids.map(c => c[0].id)]), !!drag.ratio, 24, e.altKey);
    it.w = Math.round(nb.w); if (it.type !== 'note') it.h = Math.round(nb.h); drawItem(it);
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
  main.classList.remove('panning'); $('#marq').style.display = 'none'; clearGuides(); snapCache = null;
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
  if (d.kind === 'resize' && d.moved) { changed(); drawItem(d.item); frameCounts(); }
  if (d.kind === 'gresize' && d.moved) {
    for (const [o] of d.start) { o.x = Math.round(o.x); o.y = Math.round(o.y); o.w = Math.round(o.w); if (o.type !== 'note') o.h = Math.round(o.h); }
    changed(); frameCounts();
  }
  if (d.kind === 'newframe') {
    if (d.f.w < 20 || d.f.h < 20) { board.items = board.items.filter(i => i !== d.f); sel.clear(); undoStack.pop(); redoStack.push(...d.redo0); }   // za mała ramka: jakby jej nie było
    else { d.f.x = Math.round(d.f.x); d.f.y = Math.round(d.f.y); d.f.w = Math.round(d.f.w); d.f.h = Math.round(d.f.h); changed(); setTool('select'); renameFrame(d.f); }
  }
  drawAll();
}
main.addEventListener('pointerup', endDrag);
// fokus pola tekstowego przy krawędzi (nazwa ramki, notatka) potrafi przewinąć płótno mimo overflow:hidden;
// wtedy współrzędne kursora rozjeżdżają się z elementami — płótno zawsze wraca na zero
main.addEventListener('scroll', () => { if (main.scrollLeft || main.scrollTop) { main.scrollLeft = 0; main.scrollTop = 0; } });
main.addEventListener('pointercancel', endDrag);
main.addEventListener('dblclick', e => {
  if (tool === 'pen') return;   // z mazakiem i gumką dwuklik nic nie dodaje
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
wheelKind.t = -1e9; wheelKind.k = 'pad';   // -1e9: pierwszy ruch kółka zaraz po starcie też rozpoznany na nowo
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
    [_t('Ułóż i wyrównaj…'), () => showArrangeMenu(e.clientX, e.clientY)],
    [_t('Ramka wokół zaznaczonych'), () => frameAround(selItems()), MOD + 'G'],
    [_t('Na wierzch'), () => reorder(1)], [_t('Na spód'), () => reorder(-1)],
    [_t('Pokaż'), () => fit(selItems()), 'Z'],
    '-', [_t('Usuń'), removeSel, isMac ? '⌫' : 'Delete', 'warn']
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
  if (url) {
    try {
      // w programie pobiera proces główny (okno nie może przez CORS), w przeglądarce testowej zwykły fetch
      const b = api.urlFetch ? await api.urlFetch(url).then(r => new Blob([r.bytes], { type: r.type })) : await (await fetch(url)).blob();
      if (b.type.startsWith('image/')) { addImages([[b, url.split('/').pop().split('?')[0]]], p); return; }
    } catch (err) {}
    tip(_t('Nie udało się pobrać obrazu z przeglądarki')); return;
  }
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
  const items = clip.items.map(o => JSON.parse(JSON.stringify(o))), target = board;
  // obrazy z innego blatu: kopiujemy ich pliki do bieżącego
  let missing = 0;
  if (clip.board !== target.name) for (const o of items) if (o.img) for (const f of [o.img.full, o.img.thumb]) if (f && !(await api.imageCopy(clip.board, target.name, f))) missing++;
  if (board !== target) return false;   // w trakcie przełączono blat: nie wklejamy do innego niż ten, na którym zaczęto
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
// wskaźnik pod wybranym narzędziem; w wąskim oknie część narzędzi jest schowana — gdy wybrane jest schowane, wskaźnika nie pokazujemy.
// Przeliczany po zmianie narzędzia, rozmiaru okna, trybu bez nawigacji i pełnego ekranu.
function toolInd() {
  const on = $('#tools .ib.on'), ind = $('#tools .ind'); if (!on || !ind) return;
  ind.style.transform = 'translateX(' + on.offsetLeft + 'px)'; ind.style.opacity = on.offsetParent ? '' : '0';
}
function setTool(t) {
  if (t === 'pen' && tool !== 'pen') tip(_t('Mazak: rysuj po obrazach · Shift prosta kreska · Esc kończy').replace('Shift', SHIFT));
  tool = t; if (t !== 'pen') gum = false;
  for (const b of document.querySelectorAll('#tools .ib')) b.classList.toggle('on', b.dataset.tool === t);
  toolInd();
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
  // wyrównywanie: ⌥ / Alt + A D W S (krawędzie), V H (osie), ⇧ H V (równe odstępy); e.code, bo ⌥ na Macu zmienia znak
  if (e.altKey && sel.size) {
    const A = e.shiftKey ? { KeyH: 'dx', KeyV: 'dy' } : { KeyA: 'left', KeyD: 'right', KeyW: 'top', KeyS: 'bottom', KeyV: 'cx', KeyH: 'cy' };
    if (A[e.code]) { e.preventDefault(); alignSel(A[e.code]); return; }
  }
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
    const ms = movingSet(); for (const id of ms) { const o = byId(id); o.x += dx; o.y += dy; drawItem(o); } reparent(ms); frameCounts(); changed();
  }
});
addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; main.classList.remove('space'); } });
addEventListener('blur', () => { spaceDown = false; main.classList.remove('space'); });

/* ---------- menu ---------- */
function showMenu(x, y, rows) {
  const m = $('#menu'); m.innerHTML = ''; delete m.dataset.set;
  for (const r of rows) {
    if (r === '-') { m.appendChild(document.createElement('hr')); continue; }
    const b = document.createElement('button'); if (r[3] === 'warn' || r[2] === 'warn') b.className = 'warn'; if (r[3] === 'info') { b.className = 'info'; b.disabled = true; } if (r[3] === 'acc') b.className = 'acc';
    b.innerHTML = '<span></span>' + (r[2] && r[2] !== 'warn' ? '<kbd>' + r[2] + '</kbd>' : '');
    b.firstChild.textContent = r[0];
    b.onclick = () => { hideMenu(); r[1](); };
    m.appendChild(b);
  }
  m.style.display = 'block';
  const w = m.offsetWidth, h = Math.min(m.offsetHeight, innerHeight - 16);   // w niskim oknie menu się przewija (max-height w CSS)
  m.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px'; m.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
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
  syncButtons(); applyTheme(); pillTips(); toolInd();
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
  syncButtons(); applyTheme(); pillTips(); toolInd();
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
    [_t('strzałki'), _t('przesuń zaznaczone') + ' (' + SHIFT + ' ×10)'], [isMac ? '⌫' : 'Delete', _t('usuń zaznaczone')],
    [_t('wciśnięte kółko') + ' / ' + (isMac ? '⌥' : 'Alt') + ' + ' + _t('przeciąganie'), _t('przesuwanie płótna')], [FSK, _t('pełny ekran')],
    [(isMac ? '⌥' : 'Alt') + ' + ' + _t('przeciąganie elementu'), _t('bez przyciągania')], [ALT + 'A  ' + ALT + 'D  ' + ALT + 'W  ' + ALT + 'S', _t('wyrównaj do lewej, prawej, góry, dołu')],
    [ALT + 'V  ' + ALT + 'H', _t('wyrównaj do osi pionowej / poziomej')], [ALTSH + 'H  ' + ALTSH + 'V', _t('równe odstępy w poziomie / w pionie')],
  ];
  $('#keys').innerHTML = '<div class="kc"><div class="kh"><b>' + _t('Skróty klawiszowe') + '</b><span>' + _t('? otwiera tę ściągę · Esc zamyka') + '</span></div>'
    + row(0, [K('1', _t('100%')), K('0', _t('całość'))])
    + row(20, [K('E', _t('gumka')), K('T', _t('notatka')), K('P', _t('zawsze na wierzchu'))])
    + row(34, [K('A', _t('ułóż zaznaczone')), K('F', _t('ramka'))])
    + row(54, [K('Z', _t('dopasuj zaznaczone')), K('V', _t('zaznaczanie') + '<em>Esc ' + _t('odznacz') + '</em>'), K('M', _t('mazak') + '<em>' + SHIFT + ' ' + _t('prosta kreska') + '</em>')])
    + row(0, [K('Tab', _t('ukryj interfejs'), 'w'), K(_t('spacja'), _t('przytrzymaj i przeciągnij: przesuwanie płótna'), 'sp')])
    + '<div class="km">' + L.map(([k, t]) => '<div><kbd>' + k + '</kbd>' + t + '</div>').join('') + '</div></div>';
}
function toggleKeys(v) { const o = $('#keys'); v = v == null ? !keysOpen() : v; if (v) renderKeys(); o.classList.toggle('on', v); if (v) try { localStorage.setItem('blatSeenKeys', '1'); } catch (e) {} }
function wheelTexts() { $('#zoomHint').textContent = wheelMode === 'zoom' ? _t('kółko') : MOD + _t('kółko'); if (keysOpen()) renderKeys(); }
// ustawienia: motyw, skróty, kółko myszy, aktywowanie po najechaniu (Mac), wersja i aktualizacje
let updState = null;
// Aktualizacja nie zajmuje miejsca w oknie: gdy jest nowa wersja albo trwa instalacja, przycisk ustawień ma kropkę,
// a stan i instalacja są na dole menu ustawień (WYTYCZNE_INTERAKCJE, pkt 8).
function updShow(s) {
  updState = s;
  const on = !!(s && /^(available|downloading|ready|opened)$/.test(s.state)), b = $('#setBtn');
  b.classList.toggle('upd', on);
  b.title = _t('Ustawienia') + (on && s.version ? ' · ' + _t('Nowa wersja') + ' ' + s.version : '');
  if (on && $('#menu').style.display === 'block' && $('#menu').dataset.set) showSettings();   // otwarte menu pokazuje bieżący postęp
}
function showSettings() {
  const r = $('#setBtn').getBoundingClientRect(), u = updState || {};
  const tm = themeMode();
  const rows = [
    [_t('Jasny motyw'), () => setThemeMode('light'), tm === 'light' ? '✓' : ''],
    [_t('Ciemny motyw'), () => setThemeMode('dark'), tm === 'dark' ? '✓' : ''],
    [_t('Motyw jak w systemie'), () => setThemeMode('system'), tm === 'system' ? '✓' : ''],
    '-',
    [_t('Skróty klawiszowe'), () => toggleKeys(true), '?'],
    '-',
    [_t('Ukryj interfejs'), () => toggleBare(true), 'Tab'],   // w trybie bez nawigacji przycisku ustawień nie widać, więc tylko „ukryj”
    '-',
    [_t('Kółko myszy przybliża'), () => setWheelMode('zoom'), wheelMode === 'zoom' ? '✓' : ''],
    [_t('Kółko myszy przesuwa'), () => setWheelMode('pan'), wheelMode === 'pan' ? '✓' : ''],
    '-',
    ...(isMac || api.web ? [[_t('Aktywuj Blat po najechaniu kursorem'), () => setHoverFocus(!hoverFocus), hoverFocus ? '✓' : ''], '-'] : []),
    ['Blat ' + (u.current || ''), () => {}, '', 'info']
  ];
  const inst = () => api.updateInstall && api.updateInstall();
  if (u.state === 'available') rows.push([_t('Zainstaluj wersję') + ' ' + u.version, inst, '', 'acc']);
  else if (u.state === 'downloading') rows.push([_t('Pobieram wersję') + ' ' + u.version + (u.size ? ' — ' + Math.round(u.got / u.size * 100) + '%' : ''), () => {}, '', 'info']);
  else if (u.state === 'ready') rows.push([_t('Instaluję…'), () => {}, '', 'info']);
  else if (u.state === 'opened') rows.push([_t('Przeciągnij Blat do Programów'), inst, '', 'acc']);   // ponownie otwiera pobrany obraz dysku
  else rows.push([_t('Sprawdź aktualizacje'), checkUpdates]);
  showMenu(r.left, r.bottom + 6, rows);
  const m = $('#menu'); m.dataset.set = '1'; m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px'; m.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8)) + 'px';
}
async function checkUpdates() {
  if (!api.updateCheck) return;
  tip(_t('Sprawdzam aktualizacje…'));
  const s = await api.updateCheck(); updState = { ...(updState || {}), ...s };
  updShow(updState);
  if (s.state === 'available') tip(_t('Dostępna wersja') + ' ' + s.version + ' — ' + _t('zainstalujesz ją w ustawieniach'));
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
/* ---------- wciśnięcie przycisku ---------- */
// :active trwa tyle co kliknięcie (~0,1 s) i ugięcie ikony ledwo zaczyna się przed puszczeniem;
// trzymamy je co najmniej 90 ms, a po puszczeniu ikona wraca sprężyną (przejście z .ib>svg)
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('.ib'); if (!b || e.button) return;
  b.classList.add('wcis'); const t0 = performance.now();
  const up = () => { removeEventListener('pointerup', up); removeEventListener('pointercancel', up); setTimeout(() => b.classList.remove('wcis'), Math.max(0, 90 - (performance.now() - t0))); };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
});
/* ---------- podpowiedzi przy przyciskach ---------- */
// zamiast systemowego dymka: po 1,5 s bez ruchu pod przyciskiem pojawia się nazwa i skrót; między sąsiednimi przyciskami od razu
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
  const el = e.target.closest && e.target.closest('.ib'); if (!el || el === hintEl) return;
  if (el.title) { el.dataset.tip = el.title; el.removeAttribute('title'); }   // systemowy dymek nie dubluje naszego
  hintHide(); hintEl = el;
  hintT = setTimeout(() => { if (hintEl === el) hintShow(el); }, Date.now() - hintLast < 400 ? 0 : 1500);
});
document.addEventListener('pointerout', e => { const el = e.target.closest && e.target.closest('.ib'); if (el && el === hintEl && !el.contains(e.relatedTarget)) hintHide(); });
// opis zmieniony przez program (przypinka, motyw, pełny ekran…) też trafia do data-tip, bez systemowego dymka
new MutationObserver(ms => { for (const m of ms) { const el = m.target; if (!el.title || !el.matches('.ib')) continue; el.dataset.tip = el.title; el.removeAttribute('title'); if (el === hintEl && $('#hint').classList.contains('on')) hintShow(el); } })
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
  $('#arrangeBtn').innerHTML = IC.arrange; $('#arrangeBtn').title = _t('Ułóż i wyrównaj'); $('#arrangeBtn').onclick = e => { e.stopPropagation(); showArrangeMenu(); };
  $('#topBtn').onclick = () => toggleTop(); $('#pillTop').onclick = e => { e.stopPropagation(); toggleTop(); }; $('#pinMark').innerHTML = IC.pinOn; toggleTop(onTop);
  $('#setBtn').innerHTML = IC.set; $('#setBtn').title = _t('Ustawienia'); $('#setBtn').onclick = e => { e.stopPropagation(); showSettings(); };
  $('#keys').addEventListener('click', e => { if (!e.target.closest('.kc')) toggleKeys(false); });
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
  main.addEventListener('pointermove', e => { if (!gum) return; const g = $('#gumCur'), r = main.getBoundingClientRect(); g.style.left = (e.clientX - r.left) + 'px'; g.style.top = (e.clientY - r.top) + 'px'; }, { passive: true });
  addEventListener('mousemove', () => { document.body.classList.add('moving'); syncButtons(); clearTimeout(idleT); idleT = setTimeout(() => { document.body.classList.remove('moving'); syncButtons(); }, 2000); }, { passive: true });
  if (api.onFullscreen) api.onFullscreen(onFullscreen); else document.addEventListener('fullscreenchange', () => onFullscreen(!!document.fullscreenElement));
  setTool('select'); emptyTexts(); applyTheme(); pillTips();
  // zamykanie okna (także przed instalacją aktualizacji): proces główny czeka, aż zapiszemy ostatnie zmiany i widok
  // najpierw kończymy edycję (tekst notatki i nazwy trafia do danych dopiero przy opuszczeniu pola);
  // zwraca false, gdy zapis się nie udał — wtedy okno zostaje otwarte, a drugie zamknięcie zamyka już bez zapisu
  const flush = async reason => {
    if (!board) return true;
    const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur();
    await new Promise(r => setTimeout(r));   // zmiana nazwy po opuszczeniu pola zaczyna się asynchronicznie
    while (renaming) await renaming;
    clearTimeout(viewT); if (viewT) { viewT = 0; dirty = true; }
    await saveNow();
    if (dirty && reason !== 'update') tip(_t('Nie udało się zapisać zmian. Zamknij jeszcze raz, żeby wyjść bez zapisu.'));   // przy aktualizacji mówi o tym jej komunikat
    return !dirty;
  };
  if (api.onFlush) api.onFlush(flush); else addEventListener('beforeunload', () => { if (dirty || viewT) api.boardSave(board.name, board); });
  // aktualizacje: kropka na przycisku ustawień, reszta w menu ustawień (opened: na Macu pobrany obraz dysku jest otwarty,
  // przeciągnięcie do Programów robi użytkownik)
  if (api.onUpdateStatus) {
    const show = updShow;
    // błąd pokazujemy tylko po próbie pobrania (nie przy cichym sprawdzaniu w tle); kod z procesu głównego tłumaczymy tutaj
    const UPDERR = { network: 'brak połączenia', incomplete: 'pobrany plik jest niepełny', checksum: 'pobrany plik jest uszkodzony', disk: 'nie udało się zapisać pliku', save: 'najpierw trzeba zapisać zmiany w blacie' };
    api.onUpdateStatus(s => { const err = s && s.error && updState && /^(downloading|ready)$/.test(updState.state); updState = s; show(s); if (err) tip(_t('Nie udało się pobrać aktualizacji') + ': ' + _t(UPDERR[s.error] || UPDERR.network)); }); api.updateGet().then(s => { updState = s; show(s); });
  }
}

/* ---------- polecenia testowe (umiejętność test-w-przegladarce) ---------- */
window.blatTest = {
  state: () => ({ board: board && board.name, items: board ? board.items.length : 0, sel: [...sel], view: board && { ...board.view }, tool, dirty, errors: errors.slice() }),
  items: () => JSON.parse(JSON.stringify(board.items)),
  // n sztucznych obrazów w kolorach — do testów i do sprawdzianu wydajności
  async addTest(n = 4, w = 1600, h = 1000) { return (await addImages(await this.testBlobs(n, w, h))).map(i => i.id); },
  async testBlobs(n = 4, w = 1600, h = 1000) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      g.fillStyle = 'hsl(' + (i * 47 % 360) + ',25%,' + (45 + i % 3 * 10) + '%)'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.6)'; g.font = Math.round(h / 4) + 'px sans-serif'; g.fillText(String(i + 1), w / 10, h / 2);
      out.push([await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8)), 'test-' + (i + 1) + '.jpg']);
    }
    return out;
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
  align: how => alignSel(how),
  tool: t => { if (t) setTool(t); return tool; },
  top: v => { toggleTop(v); return onTop; },
  theme: m => { if (m) setThemeMode(m); return themeMode(); },
  reorder: d => reorder(d),
  resize: (id, w) => { const it = byId(id); if (!it) return; snapshot(); const o = { x: it.x, y: it.y, w: it.w, h: it.h }, k = w / it.w; it.w = Math.round(w); if (it.type !== 'note') it.h = Math.round(it.h * k); if (it.type === 'image') followParent(it, o); drawAll(); changed(); },
  rename: to => renameBoard(to),
  trash: n => trashBoard(n || board.name),
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
      toggleBare(true); document.body.classList.remove('moving'); toggleTop(true); const pm = $('#pinMark'); ok(pm && getComputedStyle(pm).display !== 'none', 'w trybie bez nawigacji przypięcie widać w rogu');
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
          ok(hl && hl.hl === true && hl.c !== PEN && hl.sw > penPx(0, 2) / board.view.z * 1.5, 'zakreślacz zapisuje się jako półprzezroczysta kreska w swoim kolorze');
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
          sel = new Set([f.id]); this.cut(); ok(!byId(f.id) && inside0.every(id => !byId(id)) && board.items.length === nb2 - 1 - inside0.length, 'wycięcie ramki zabiera jej zawartość');
          this.undo(); ok(byId(f.id) && inside0.every(id => byId(id)), 'cofnięcie wycięcia ramki'); } }
      // tekst ze schowka z końcami wierszy Windows nadal rozpoznany jako nasza kopia
      { sel = new Set([cut.id]); const t = this.copy(); ok(isOurClip(t.replace(/\n/g, '\r\n')), 'kopia rozpoznana także z końcami wierszy Windows'); }
      // na inny blat: pliki obrazów jadą razem z nim
      const src = board.name; sel = new Set([im.id]); this.copy(); await this.newBoard('Wklejanie ' + Date.now()); await this.paste();
      const ni = board.items.find(i => i.type === 'image'); ok(ni && lastPaste && lastPaste.missing === 0, 'obraz wklejony na inny blat ma swój plik w nowym blacie');
      const tmp = board.name; await this.open(src); await api.boardTrash(tmp); await refreshBoards();
      sel = new Set([dr.id]); this.remove(); sel.clear(); drawAll();
    }
    // ustawienia w prawym górnym rogu, motyw i skróty w menu ustawień (wspólna zasada rodziny, 26.11.2026)
    { const sb = $('#setBtn'), hd = $('header'), btns = [...hd.querySelectorAll('.ib')].filter(b => b.offsetParent);
      ok(sb && hd.contains(sb) && btns[btns.length - 1] === sb, 'przycisk ustawień jest ostatni w górnym pasku');
      ok(!$('#themeBtn') && !$('#keysBtn'), 'na dole bocznego paska nie ma osobnych przycisków motywu i ściągi');
      const th0 = localStorage.getItem('blatTheme'); showSettings(); await new Promise(r => setTimeout(r, 30)); const t = $('#menu').innerText;
      ok(t.includes(_t('Jasny motyw')) && t.includes(_t('Ciemny motyw')) && t.includes(_t('Motyw jak w systemie')) && t.includes(_t('Skróty klawiszowe')), 'menu ustawień ma motyw i skróty klawiszowe');
      const mr = $('#menu').getBoundingClientRect(), br = sb.getBoundingClientRect(); ok(mr.top >= br.bottom - 1 && mr.right <= innerWidth, 'menu ustawień otwiera się pod przyciskiem');
      hideMenu(); setThemeMode('dark'); ok(document.documentElement.dataset.theme === 'dark', 'ciemny motyw z ustawień'); setThemeMode('light'); ok(document.documentElement.dataset.theme === 'light', 'jasny motyw z ustawień');
      if (th0) localStorage.setItem('blatTheme', th0); else localStorage.removeItem('blatTheme'); applyTheme(); }
    // ustawienia: wersja, aktualizacje, aktywowanie po najechaniu (prośba Michała 25.11.2026)
    { showSettings(); await new Promise(r => setTimeout(r, 50)); const t = $('#menu').innerText;
      ok(/Blat \S+/.test(t) && t.includes(_t('Sprawdź aktualizacje')), 'ustawienia pokazują wersję i „Sprawdź aktualizacje”');
      ok(t.includes(_t('Aktywuj Blat po najechaniu kursorem')), 'ustawienia mają aktywowanie po najechaniu'); hideMenu();
      const r0 = typeof hoverFocus !== 'undefined' && hoverFocus; if (typeof setHoverFocus === 'function') { setHoverFocus(true); ok(localStorage.getItem('blatHoverFocus') === '1', 'aktywowanie po najechaniu zapamiętane'); setHoverFocus(r0); } }
    // zmiana opisu przycisku (np. przypinka) nie przywraca systemowego dymka (uwaga recenzenta)
    { toggleTop(true); toggleTop(false); await new Promise(r => setTimeout(r, 30)); ok(!$('#topBtn').title && ($('#topBtn').dataset.tip || '').length > 0, 'przycisk po zmianie opisu nie ma systemowego dymka'); }
    // wciśnięcie przycisku widać także przy szybkim kliknięciu (ikona ugina się i sprężyście wraca)
    { const b = $('#arrangeBtn'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
      ok(b.classList.contains('wcis'), 'po szybkim kliknięciu przycisk zostaje chwilę wciśnięty'); await new Promise(r => setTimeout(r, 160)); ok(!b.classList.contains('wcis'), 'i wraca'); }
    // podpowiedź po zatrzymaniu kursora na narzędziu
    { hintLast = 0; const b = $('#tools .ib[data-tool="pen"]'); b.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); await new Promise(r => setTimeout(r, 700));
      ok(!$('#hint').classList.contains('on'), 'opis nie pojawia się przed upływem 1,5 s'); await new Promise(r => setTimeout(r, 900));
      const h = $('#hint'); ok(h && h.classList.contains('on') && h.textContent.includes(_t('Mazak')) && !b.title, 'po zatrzymaniu kursora na narzędziu pojawia się jego opis');
      b.dispatchEvent(new PointerEvent('pointerout', { bubbles: true })); await new Promise(r => setTimeout(r, 50)); ok(h && !h.classList.contains('on'), 'opis znika po zjechaniu z narzędzia'); }
    // ===== audyt 27.11.2026 =====
    // pełny obraz tylko dla obrazów na ekranie (albo tuż obok), reszta zostaje przy miniaturze
    { const far = await this.addTest(2, 1600, 1000); const [a, b] = far.map(byId); b.x = a.x + 20000; drawAll();
      fit([a]); zoomAt(Math.max(1.05, 1000 / (Math.max(a.w, a.h) * board.view.z * DPR()))); await new Promise(r => setTimeout(r, 250));   // obraz na ekranie > 720 px w każdym oknie
      const src = it => els.get(it.id).firstChild.getAttribute('src');
      ok(src(a) === api.imageUrl(board.name, a.img.full), 'obraz na ekranie po przybliżeniu dostaje pełny plik');
      ok(src(b) === api.imageUrl(board.name, b.img.thumb), 'obraz daleko poza ekranem zostaje przy miniaturze');
      sel = new Set(far); removeSel(); fit(); }
    // nieudany zapis (np. odrzucona podmiana pliku na Windows) ponawia się sam
    const eN = errors.length;   // błędy wywołane celowo (EPERM, zapis blatu z kosza) zdejmujemy po tych przypadkach
    { api._failSave = 1; const n0 = byId(this.note(0, -600, 'zapis z ponowieniem')); await this.save(); clearTimeout(viewT);
      ok(dirty && $('#saved').textContent === _t('nie udało się zapisać'), 'nieudany zapis zostaje oznaczony');
      await new Promise(r => setTimeout(r, 2300)); const back = await api.boardLoad(board.name); api._failSave = 0;
      ok(!dirty && back && back.items.some(i => i.id === n0.id), 'nieudany zapis ponawia się bez kolejnej zmiany'); }
    // dwa zapisy naraz nie mieszają się, a po nich w pliku jest ostatni stan
    { const nn = byId(this.note(0, -700, 'pierwszy')); dirty = true; const p1 = saveNow(); nn.text = 'drugi'; dirty = true; const p2 = saveNow(); await Promise.all([p1, p2]);
      const back = await api.boardLoad(board.name); ok(back.items.find(i => i.id === nn.id).text === 'drugi', 'dwa zapisy pod rząd: w pliku zostaje ostatni stan'); }
    // import kilku obrazów przerwany przełączeniem blatu nie miesza plików między blatami
    { const src = board.name, other = await this.newBoard('Przełączanie ' + Date.now()); await this.open(src);
      const n0 = board.items.length, bl = await this.testBlobs(3, 900, 600), pr = addImages(bl); await this.open(other); await pr; await new Promise(r => setTimeout(r, 100));
      ok(board.name === other && !board.items.some(i => i.type === 'image'), 'obrazy importowane w tle nie trafiają do blatu, na który przełączono');
      await this.open(src); const imgs = board.items.filter(i => i.type === 'image');
      ok(board.items.length === n0 + 3 && imgs.every(i => api.imageUrl(src, i.img.full)), 'obrazy trafiają do blatu, na którym zaczął się import, razem z plikami');
      await api.boardTrash(other); await refreshBoards(); }
    // zapis blatu przeniesionego do kosza nie odtwarza go
    { const t = await this.newBoard('Kosz ' + Date.now()); this.note(0, 0, 'x'); await api.boardTrash(t); dirty = true; await saveNow(); const r = await api.boardsList();
      ok(!r.boards.some(b => b.name === t), 'zapis blatu z kosza nie tworzy go na nowo'); await this.open(name); }
    // folder blatu znika w trakcie pracy: zmiany zostają w oknie, napis mówi o tym, a gdy folder wróci, zapis się udaje
    { const t = await this.newBoard('Znika ' + Date.now()); const n1 = byId(this.note(0, 0, 'nie zgubić')); await this.save();
      await api.boardTrash(t); dirty = true; await saveNow();
      ok(dirty && $('#saved').textContent === _t('Folder blatu zniknął — zmiany nie są zapisywane'), 'zniknięcie folderu blatu: zmiany czekają w oknie i jest o tym napis');
      await api.boardNew(t); clearTimeout(saveT); await saveNow(); const back = await api.boardLoad(t);
      ok(!dirty && back && back.items.some(i => i.id === n1.id), 'gdy folder wraca, czekające zmiany się zapisują'); await api.boardTrash(t); await this.open(name); }
    errors.splice(eN, errors.length - eN, ...errors.slice(eN).filter(m => !/EPERM|nie istnieje/.test(m)));
    // menu kontekstowe w niskim oknie mieści się w oknie i nie wchodzi pod pasek okna
    { showMenu(20, 4, Array.from({ length: 60 }, (_, i) => ['Pozycja ' + i, () => {}])); const r = $('#menu').getBoundingClientRect();
      ok(r.top >= 8 && r.bottom <= innerHeight, 'długie menu mieści się w oknie'); ok(getComputedStyle($('#menu')).getPropertyValue('-webkit-app-region') === 'no-drag', 'menu nie jest obszarem przeciągania okna'); hideMenu(); }
    // podpowiedzi przy nazwie blatu i ścieżce folderu zostają (systemowe), bo nie są przyciskami
    ok(!!$('#bname').title && !!$('#where').title, 'nazwa blatu i ścieżka folderu mają podpowiedź');
    // usunięcie wyczyszczonej notatki ma własny krok cofania
    { const nn = byId(this.note(300, -500, 'do wyczyszczenia')); sel = new Set([nn.id]); this.move(50, 0); const x1 = nn.x;
      editNote(nn); els.get(nn.id).textContent = ''; els.get(nn.id).blur(); ok(!byId(nn.id), 'wyczyszczona notatka znika');
      this.undo(); const back = byId(nn.id); ok(back && back.x === x1 && back.text === 'do wyczyszczenia', 'cofnięcie przywraca notatkę bez cofania wcześniejszej zmiany');
      sel = new Set([nn.id]); removeSel(); }
    // licznik w ramce odświeża się po przesunięciu strzałkami
    { const f = board.items.find(i => i.type === 'frame'), o = f && board.items.find(i => i.type === 'image' && inside(i, f));
      if (f && o) { sel = new Set([o.id]); for (let i = 0; i < 40; i++) dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true }));
        const n = board.items.filter(x => x.type !== 'frame' && x.type !== 'drawing' && inside(x, f)).length;
        ok(els.get(f.id).querySelector('span').textContent === (n ? n + ' ' + plural(n, 'element', 'elementy', 'elementów') : ''), 'licznik ramki po przesunięciu strzałkami');
        this.undo(); sel.clear(); drawAll(); } else ok(false, 'licznik ramki: brak ramki z obrazem'); }
    // dwuklik z mazakiem nie tworzy notatki
    { setTool('pen'); const n0 = board.items.length, r = main.getBoundingClientRect();
      main.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + 5, clientY: r.bottom - 5 }));
      ok(board.items.length === n0, 'dwuklik z mazakiem nie tworzy notatki'); setTool('select'); }
    // samo kliknięcie w uchwyt zmiany rozmiaru nie dodaje kroku cofania
    { const im = board.items.find(i => i.type === 'image'); sel = new Set([im.id]); drawAll(); const u0 = undoStack.length, hd = els.get(im.id).querySelector('.hd'), r = hd.getBoundingClientRect();
      hd.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX: r.left + 3, clientY: r.top + 3, pointerId: 1 }));
      main.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: r.left + 3, clientY: r.top + 3, pointerId: 1 }));
      ok(undoStack.length === u0, 'kliknięcie w uchwyt bez przeciągania nie dodaje kroku cofania'); sel.clear(); drawAll(); }
    // notatka przyjmuje wklejany tekst bez formatowania
    { const nn = byId(this.note(0, -800, 'x')); ok(/plaintext-only/.test(els.get(nn.id).getAttribute('contenteditable') || '') || (editNote(nn), els.get(nn.id).contentEditable === 'plaintext-only'), 'notatka przy edycji przyjmuje tylko czysty tekst'); els.get(nn.id).blur(); }
    // skróty w menu zgodne z systemem
    { const im = board.items.find(i => i.type === 'image'); sel = new Set([im.id]); drawAll(); const r = els.get(im.id).getBoundingClientRect();
      main.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5 }));
      const t = $('#menu').innerText; ok(isMac ? t.includes('⌫') && !t.includes('Del') : t.includes('Delete'), 'skrót usuwania w menu zgodny z systemem'); hideMenu(); sel.clear(); drawAll(); }
    { renderKeys(); const t = $('#keys').innerText; ok(isMac || !t.includes('⇧'), 'ściąga na Windows pisze Shift, nie ⇧'); }
    // w trybie bez nawigacji pastylka, gdy jej nie widać, nie blokuje przeciągania okna
    { toggleBare(true); document.body.classList.remove('moving'); ok(getComputedStyle($('#fspill')).getPropertyValue('-webkit-app-region') !== 'no-drag', 'niewidoczna pastylka nie blokuje przeciągania okna'); toggleBare(false); }
    // zmiana nazwy trwa, a w tym czasie kliknięto inny blat: nowa nazwa dostaje się temu blatowi, który zmieniano (zgłoszenie recenzenta)
    { const A = await this.newBoard('A ' + Date.now()); const na = byId(this.note(0, 0, 'treść A')); await this.save();
      const B = await this.newBoard('B ' + Date.now()); const nb = byId(this.note(0, 0, 'treść B')); await this.save();
      api._slowRename = 200; const pr = this.rename(B + ' nowa'); const po = this.open(A); await pr; await po; api._slowRename = 0;
      const bn = await api.boardLoad(B + ' nowa'), an = await api.boardLoad(A);
      ok(bn && bn.items.some(i => i.id === nb.id) && !bn.items.some(i => i.id === na.id) && an && an.items.some(i => i.id === na.id) && board.name === A, 'zmiana nazwy w trakcie przełączania blatu nie miesza treści blatów');
      await api.boardTrash(A); await api.boardTrash(B + ' nowa'); await this.open(name); }
    // nowy blat w trakcie zmiany nazwy: nowa nazwa trafia do zmienianego blatu, a po ponownym otwarciu blat ma nazwę folderu
    { const A = await this.newBoard('Zmiana ' + Date.now()); this.note(0, 0, 'a'); await this.save(); api._slowRename = 200;
      const pr = this.rename(A + ' v1'); const nb = newBoard(); await pr; await nb; api._slowRename = 0; const inp = $('header input'); if (inp) inp.blur();   // pole nazwy nowego blatu await new Promise(r => setTimeout(r, 50));
      const back = await api.boardLoad(A + ' v1'); ok(back && back.name === A + ' v1' && back.items.length === 1, 'nowy blat w trakcie zmiany nazwy: zmieniony blat ma nową nazwę i swoją treść');
      ok(board.name !== A + ' v1' && board.name !== A, 'nowy blat jest osobnym blatem'); const nn = board.name; await this.open(name); await api.boardTrash(A + ' v1'); await api.boardTrash(nn); await refreshBoards(); }
    // wskaźnik narzędzi po trybie bez nawigacji
    { this.bare(true); this.tool('note'); this.bare(false); const ind = $('#tools .ind'), on = $('#tools .ib[data-tool="note"]');
      ok(ind.style.opacity !== '0' && on.offsetLeft > 0 && ind.style.transform === 'translateX(' + on.offsetLeft + 'px)', 'wskaźnik narzędzi po wyjściu z trybu bez nawigacji stoi pod narzędziem'); this.tool('select'); }
    // import skończony po przełączeniu blatu nie zmienia „ostatnio otwartego” blatu
    { const src = board.name, other = await this.newBoard('Ostatni ' + Date.now()); await this.open(src); const bl = await this.testBlobs(2, 600, 400), pr = addImages(bl); await this.open(other); await pr;
      ok((await api.boardsList()).last === other, 'import w tle nie zmienia ostatnio otwartego blatu'); await this.open(src); await api.boardTrash(other); await refreshBoards(); }
    // polecenia testowe dla funkcji bez myszy: zmiana nazwy, kolejność warstw, narzędzie, motyw, rozmiar
    { const t = await this.newBoard('Nazwa ' + Date.now()); const n2 = await this.rename(t + ' b'); ok(n2 === t + ' b' && board.name === n2 && (await api.boardsList()).boards.some(x => x.name === n2), 'zmiana nazwy blatu');
      const a = byId(this.note(0, 0, 'a')), c = byId(this.note(10, 10, 'c')); sel = new Set([a.id]); this.reorder(1); ok((a.z || 0) > (c.z || 0), 'na wierzch'); this.reorder(-1); ok((a.z || 0) < (c.z || 0), 'na spód');
      ok(this.tool('pen') === 'pen' && this.tool('select') === 'select', 'wybór narzędzia');
      const im = byId((await this.addTest(1, 800, 400))[0]), w0 = im.w; this.resize(im.id, w0 * 2); ok(im.w === w0 * 2 && Math.abs(im.w / im.h - 2) < .02, 'zmiana rozmiaru obrazu z zachowaniem proporcji'); this.undo(); ok(byId(im.id).w === w0, 'cofnięcie zmiany rozmiaru');
      await this.trash(); ok(!(await api.boardsList()).boards.some(x => x.name === n2), 'przeniesienie blatu do kosza'); await this.open(name); }
    // aktualizacja nie siedzi w bocznym pasku: kropka na przycisku ustawień, stan i instalacja w menu ustawień (zgłoszenie Michała 27.11)
    { const u0 = updState; updShow({ state: 'ready', version: '9.9.9', current: '0.2.6' });
      ok(!$('aside #upd') && !document.querySelector('aside button:not(.ib)'), 'w bocznym pasku nie ma informacji o aktualizacji');
      ok($('#setBtn').classList.contains('upd'), 'nowa wersja: kropka na przycisku ustawień');
      showSettings(); ok($('#menu').innerText.includes(_t('Instaluję…')), 'stan aktualizacji w menu ustawień'); hideMenu();
      updShow({ state: 'none', current: '0.2.6' }); ok(!$('#setBtn').classList.contains('upd'), 'bez nowej wersji nie ma kropki'); updState = u0; updShow(u0); }
    // ustawienia mają „Ukryj interfejs” (Tab), jak menu kontekstowe płótna (prośba Michała 27.11)
    { showSettings(); const row = [...$('#menu').querySelectorAll('button')].find(x => x.firstChild.textContent === _t('Ukryj interfejs'));
      ok(row && row.querySelector('kbd') && row.querySelector('kbd').textContent === 'Tab', 'w ustawieniach jest „Ukryj interfejs” ze skrótem Tab');
      if (row) row.click(); ok(isBare(), '„Ukryj interfejs” w ustawieniach chowa interfejs'); toggleBare(false); hideMenu(); }
    // pole tekstowe przy krawędzi (np. nazwa ramki) nie może przewinąć płótna — inaczej kursor i elementy się rozjeżdżają
    { main.scrollLeft = 300; main.scrollTop = 200; await new Promise(r => setTimeout(r, 30)); ok(main.scrollLeft === 0 && main.scrollTop === 0, 'płótno nie daje się przewinąć (fokus pola tekstowego)'); }
    // ===== wyrównywanie, przyciąganie, skalowanie wielu (prośba Michała 27.11, jak w Blacie w przeglądarce i w Miro) =====
    { const tb = await this.newBoard('Wyrównanie ' + Date.now()), tin = $('header input'); if (tin) tin.blur();   // osobny blat: inne elementy nie wpływają na przyciąganie
      const ids = await this.addTest(3, 800, 600); let [a, b, c] = ids.map(byId); const rebind = () => { [a, b, c] = ids.map(byId); };   // cofanie podmienia obiekty elementów
      const put = () => { a.x = 0; a.y = 0; a.w = 400; a.h = 300; b.x = 500; b.y = 60; b.w = 300; b.h = 150; c.x = 900; c.y = -40; c.w = 200; c.h = 300; drawAll(); };
      put(); sel = new Set(ids);
      this.align('top'); ok(a.y === -40 && b.y === -40 && c.y === -40, 'wyrównaj do góry');
      put(); this.align('bottom'); ok(a.y + a.h === 300 && b.y + b.h === 300 && c.y + c.h === 300, 'wyrównaj do dołu');
      put(); this.align('cy'); const cy = v => v.y + v.h / 2; ok(Math.abs(cy(a) - cy(b)) <= 1 && Math.abs(cy(b) - cy(c)) <= 1, 'wyrównaj do osi poziomej (środki na jednej wysokości)');
      put(); this.align('left'); ok(a.x === 0 && b.x === 0 && c.x === 0, 'wyrównaj do lewej');
      put(); this.align('right'); ok(a.x + a.w === 1100 && b.x + b.w === 1100, 'wyrównaj do prawej');
      put(); this.align('cx'); const cx = v => v.x + v.w / 2; ok(Math.abs(cx(a) - cx(b)) <= 1 && Math.abs(cx(a) - cx(c)) <= 1, 'wyrównaj do osi pionowej');
      put(); b.x = 420; drawAll(); this.align('dx'); ok(Math.abs((b.x - (a.x + a.w)) - (c.x - (b.x + b.w))) <= 1 && a.x === 0 && c.x + c.w === 1100, 'równe odstępy w poziomie, skrajne zostają');
      put(); const r0 = [a, b, c].map(v => v.w / v.h); this.align('sameH');
      ok(a.h === b.h && b.h === c.h && [a, b, c].every((v, i) => Math.abs(v.w / v.h - r0[i]) < .02), 'wspólna wysokość z zachowaniem proporcji');
      ok(b.x >= a.x + a.w && c.x >= b.x + b.w, 'po wspólnej wysokości obrazy w rzędzie nie nachodzą na siebie');
      put(); this.align('sameW'); ok(a.w === b.w && b.w === c.w && [a, b, c].every((v, i) => Math.abs(v.w / v.h - r0[i]) < .02), 'wspólna szerokość z zachowaniem proporcji');
      put(); const u0 = undoStack.length; this.align('top'); ok(undoStack.length === u0 + 1, 'wyrównanie to jeden krok cofania'); this.undo(); rebind(); ok(b.y === 60 && c.y === -40, 'cofnięcie wyrównania');
      // kreska mazaka jedzie z obrazem, ramka z zawartością wyrównuje się w całości
      put(); const st = byId(this.stroke([[b.x + 20, b.y + 20], [b.x + 80, b.y + 40]])), sx = st.x - b.x, sy = st.y - b.y;
      sel = new Set(ids); this.align('top'); ok(Math.abs(st.x - b.x - sx) < 1 && Math.abs(st.y - b.y - sy) < 1, 'kreska mazaka jedzie z wyrównanym obrazem');
      put(); sel = new Set([c.id]); frameAround([c]); const fr = selItems()[0]; const fin = document.querySelector('.fl input'); if (fin) fin.blur(); const off = c.y - fr.y; sel = new Set([a.id, fr.id]); this.align('top');
      ok(fr.y === Math.min(0, fr.y) && c.y - fr.y === off, 'ramka wyrównuje się razem z zawartością');
      sel = new Set([fr.id]); removeSel(); sel = new Set([st.id]); removeSel();
      // za mało zaznaczonych: przycisk potrząsa się i jest podpowiedź
      sel = new Set([a.id]); this.align('left'); ok($('#arrangeBtn').classList.contains('nie'), 'wyrównanie jednego elementu: przycisk potrząsa się');
      sel = new Set([a.id, b.id]); put(); this.align('dx'); ok(b.x === 500 && $('#arrangeBtn').classList.contains('nie'), 'równe odstępy potrzebują trzech elementów');
      // skróty ⌥/Alt
      put(); sel = new Set(ids); dispatchEvent(new KeyboardEvent('keydown', { key: isMac ? 'å' : 'a', code: 'KeyA', altKey: true })); ok(a.x === 0 && b.x === 0 && c.x === 0, '⌥A / Alt+A wyrównuje do lewej');
      put(); dispatchEvent(new KeyboardEvent('keydown', { key: 'H', code: 'KeyH', altKey: true, shiftKey: true })); ok(Math.abs((b.x - (a.x + a.w)) - (c.x - (b.x + b.w))) <= 1, '⌥⇧H / Alt+Shift+H: równe odstępy w poziomie');
      // przycisk układania otwiera menu z wyrównaniem
      put(); $('#arrangeBtn').click(); const mt = $('#menu').innerText; ok(mt.includes(_t('Wyrównaj do lewej')) && mt.includes(_t('Wspólna wysokość')) && mt.includes(_t('Równe odstępy w poziomie')) && mt.includes(_t('Ułóż w rzędach')), 'przycisk układania otwiera menu wyrównywania'); hideMenu();
      // przyciąganie przy przesuwaniu: krawędź do krawędzi, z linią pomocniczą; ⌥/Alt wyłącza
      const drag = async (el, fx, fy, tx, ty, opt = {}) => { const P = (t, x, y, tg) => tg.dispatchEvent(new PointerEvent(t, { bubbles: true, button: 0, buttons: t === 'pointerup' ? 0 : 1, clientX: x, clientY: y, pointerId: 1, ...opt }));
        P('pointerdown', fx, fy, el); P('pointermove', (fx + tx) / 2, (fy + ty) / 2, main); P('pointermove', tx, ty, main); const g = $('#guides') ? $('#guides').childElementCount : 0; P('pointerup', tx, ty, main); return g; };
      const scr = (x, y) => { const r = main.getBoundingClientRect(), v = board.view; return [r.left + v.x + x * v.z, r.top + v.y + y * v.z]; };
      put(); sel.clear(); drawAll(); fit([a, b]); await new Promise(r => setTimeout(r, 30));
      let [fx, fy] = scr(b.x + 50, b.y + 50), [tx, ty] = scr(b.x + 50, b.y + 50 - 60 + 3 / board.view.z);   // b o 57 w górę → górna krawędź 3 px ekranu pod górą a
      let g = await drag(els.get(b.id), fx, fy, tx, ty); ok(b.y === a.y, 'przesuwany obraz przyciąga się do krawędzi innego'); ok(g > 0, 'przy przyciąganiu widać linię pomocniczą'); ok(!$('#guides') || !$('#guides').childElementCount, 'po puszczeniu linie znikają');
      put(); [fx, fy] = scr(b.x + 50, b.y + 50); [tx, ty] = scr(b.x + 50, b.y + 50 - 60 + 3 / board.view.z); await drag(els.get(b.id), fx, fy, tx, ty, { altKey: true }); ok(b.y !== a.y, '⌥ / Alt przy przeciąganiu wyłącza przyciąganie');
      this.undo(); rebind();
      // równe odstępy: trzeci obraz przyciąga się do odstępu jak między pierwszymi dwoma
      put(); b.y = 0; b.h = 300; b.w = 300; c.y = 0; c.x = 900 + 7; drawAll(); fit([a, b, c]); await new Promise(r => setTimeout(r, 30));   // odstęp a–b = 100, b–c = 107
      [fx, fy] = scr(c.x + 50, c.y + 50); [tx, ty] = scr(c.x + 50 - 5, c.y + 50); await drag(els.get(c.id), fx, fy, tx, ty); ok(c.x - (b.x + b.w) === 100, 'przyciąganie do równego odstępu');
      // zmiana rozmiaru przyciąga prawą krawędź do krawędzi innego obrazu
      put(); a.y = 400; drawAll(); sel = new Set([a.id]); drawAll(); fit([a, b]); await new Promise(r => setTimeout(r, 30));
      const hd = els.get(a.id).querySelector('.hd'), hr = hd.getBoundingClientRect(); [tx, ty] = scr(b.x + b.w - 4 / board.view.z, a.y + a.h);
      await drag(hd, hr.left + 4, hr.top + 4, tx, ty); ok(a.x + a.w === b.x + b.w, 'zmiana rozmiaru przyciąga się do krawędzi innego obrazu');
      // skalowanie wielu: wspólna ramka zaznaczenia z uchwytem, proporcje i odległości skalują się razem
      put(); sel = new Set([a.id, b.id]); drawAll(); fit([a, b]); await new Promise(r => setTimeout(r, 30));
      const gb = $('#gbox'), gh = gb && gb.querySelector('.hd'); ok(gb && gb.style.display !== 'none' && gh, 'przy kilku zaznaczonych jest wspólna ramka z uchwytem');
      if (gh) { const box0 = bbox([a, b]), bx0 = b.x - a.x, r = gh.getBoundingClientRect(); [tx, ty] = scr(box0.x + box0.w * 1.5, box0.y + box0.h * 1.5);
        await drag(gh, r.left + 4, r.top + 4, tx, ty, { altKey: true }); const k = a.w / 400;
        ok(Math.abs(k - 1.5) < .02 && Math.abs(b.w / 300 - k) < .02 && Math.abs((b.x - a.x) / bx0 - k) < .02 && a.x === 0 && a.y === 0, 'skalowanie wielu elementów naraz od lewego górnego rogu');
        this.undo(); rebind(); ok(a.w === 400 && b.w === 300, 'cofnięcie skalowania wielu'); }
      sel = new Set([a.id]); drawAll(); ok(!$('#gbox') || $('#gbox').style.display === 'none', 'przy jednym zaznaczonym nie ma wspólnej ramki');
      sel = new Set(ids); removeSel(); await this.open(name); await api.boardTrash(tb); await refreshBoards(); fit(); }
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
