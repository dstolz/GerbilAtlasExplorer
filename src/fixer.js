/* The atlas region fixer, in the browser: tools/atlasfix.py serves this page and
   answers for it. Everything drawn here is in the page frame the tracings in svg/
   are in (3296 x 2481 px, portrait on plate 20), which is the frame a correction
   is written in; millimetres are computed from it for the reader, through the same
   two transforms tools/atlaslib.py uses -- the plate's registration matrix and
   plate_frame -- so what the status bar says is what the file will say.

   The marks are the MATLAB class's marks and no others: a seed for the name a face
   should carry, a run of boundary the tracing missed, the outline a region should
   have. Nothing here edits region_extents; a correction is one edit to a pipeline
   input, and the extents are re-cut from it. */
'use strict';

const $ = (id) => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);

const S = {
  boot: null, plate: 0, d: null, paths: [], img: null, imgM: null, layer: 'drawing',
  abbr: '', tool: 'pick', view: {k: 1, x: 0, y: 0}, at: null, pending: null,
  drag: null, cut: null, busy: 0,
  opts: {style: 'solid', closed: false, replaces: null, hemi: ''},
  show: {ink: true, ext: true, lab: true, una: false, cut: false},
  draft: {plate: 0, abbr: '', problem: '', seeds: [], boundaries: [], extents: [], notes: []},
};

/* ------------------------------------------------------------------ frames */

const xf = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function toMm(x, y) {                       // page px -> [ML, DV] mm
  const f = S.d.frame, p = xf(S.d.m, x, y);
  return [(p[0] - f.ml0) / f.mlpx, (f.dv0 - p[1]) / f.dvpx];
}
function toPage(ml, dv) {                   // [ML, DV] mm -> page px
  const f = S.d.frame;
  return xf(S.d.im, f.ml0 + ml * f.mlpx, f.dv0 - dv * f.dvpx);
}
function screenToPage(ev) {
  const r = cv.getBoundingClientRect(), v = S.view;
  return [(ev.clientX - r.left - v.x) / v.k, (ev.clientY - r.top - v.y) / v.k];
}
function pip(ring, x, y) {                  // even-odd, the app's own test
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function regionAt(x, y) {
  for (const r of S.d.regions) {
    let c = 0;
    for (const g of r.rings) if (pip(g, x, y)) c++;
    if (c % 2) return r;
  }
  return null;
}
const fmt = (v, n) => (v >= 0 ? '+' : '') + v.toFixed(n === undefined ? 2 : n);

/* -------------------------------------------------------------------- talk */

async function api(path, body) {
  S.busy++; document.body.classList.add('busy');
  try {
    const r = await fetch(path, body === undefined ? {} : {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  } finally {
    if (--S.busy === 0) document.body.classList.remove('busy');
  }
}
let toastT = 0;
function toast(msg, bad) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false; t.classList.toggle('bad', !!bad);
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 3000);
}
function report(text, bad) {
  const el = $('report');
  el.textContent = text;
  el.classList.toggle('bad', !!bad);
  el.scrollTop = 0;
}

/* ------------------------------------------------------------------- plate */

async function loadPlate(n) {
  const d = await api('/api/plate/' + n);
  S.plate = n; S.d = d; S.cut = null; S.pending = null;
  S.show.cut = false; $('v-cut').checked = false; $('v-cut').disabled = true;
  S.draft.plate = n;
  S.paths = d.paths.map((p) => ({p: new Path2D(p.d), style: p.style, corr: p.corr}));
  $('plate').value = n;
  $('where').textContent = 'plate ' + n + ', bregma ' + fmt(d.bregma) + ' mm · page '
    + d.page[0] + ' × ' + d.page[1] + ' px';
  if (!d.layers.includes(S.layer)) S.layer = d.layers[0];
  layerSeg();
  await loadImage();
  fit();
  renderRegions(); renderMarks(); selectFacts();
}

function loadImage() {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      S.img = im;
      const f = S.d.frame, sx = f.w / im.naturalWidth, sy = f.h / im.naturalHeight, m = S.d.im;
      S.imgM = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]];
      draw(); res();
    };
    im.onerror = () => { S.img = null; draw(); res(); };
    im.src = '/api/image/' + S.layer + '/' + S.plate + '.jpg';
  });
}

function layerSeg() {
  const seg = $('layerseg');
  seg.innerHTML = '';
  for (const k of S.d.layers) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = k; b.dataset.l = k;
    if (k === S.layer) b.className = 'on';
    b.onclick = () => { S.layer = k; layerSeg(); loadImage(); };
    seg.appendChild(b);
  }
}

/* ------------------------------------------------------------------ drawing */

function resize() {
  const r = cv.getBoundingClientRect();
  cv.width = Math.round(r.width * DPR); cv.height = Math.round(r.height * DPR);
  draw();
}
function fit() {
  if (!S.d) return;
  // the printed plate, not the whole page it was traced on: the page frame carries
  // the PDF's margins, and fitting those leaves the brain a third of the window
  const f = S.d.frame, m = S.d.im;
  const box = [xf(m, 0, 0), xf(m, f.w, 0), xf(m, f.w, f.h), xf(m, 0, f.h)];
  zoomTo(box, 10);
}
function zoomTo(ring, pad) {
  const r = cv.getBoundingClientRect();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const p = pad === undefined ? 60 : pad;
  x0 -= p; y0 -= p; x1 += p; y1 += p;
  const k = Math.min(r.width / (x1 - x0), r.height / (y1 - y0));
  S.view = {k, x: -x0 * k + (r.width - (x1 - x0) * k) / 2, y: -y0 * k + (r.height - (y1 - y0) * k) / 2};
  draw();
}
function setT(a, b, c, d, e, f) { ctx.setTransform(a * DPR, b * DPR, c * DPR, d * DPR, e * DPR, f * DPR); }
function page() { const v = S.view; setT(v.k, 0, 0, v.k, v.x, v.y); }
function screen() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
function W(px) { return px / S.view.k; }

function poly(pts, close) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function draw() {
  if (!S.d) return;
  const v = S.view, r = cv.getBoundingClientRect();
  screen();
  ctx.clearRect(0, 0, r.width, r.height);
  ctx.fillStyle = css('--bg'); ctx.fillRect(0, 0, r.width, r.height);

  if (S.img && S.imgM) {
    const m = S.imgM;
    setT(v.k * m[0], v.k * m[1], v.k * m[2], v.k * m[3], v.k * m[4] + v.x, v.k * m[5] + v.y);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(S.img, 0, 0);
  }
  page();

  // the section outline
  ctx.strokeStyle = 'rgba(90,90,90,.75)'; ctx.lineWidth = W(1);
  for (const o of S.d.outline) { poly(o, true); ctx.stroke(); }

  // every region as it stands, the chosen one boldly; or the recut, when shown
  if (S.show.ext) {
    const src = (S.show.cut && S.cut) ? S.cut.regions : S.d.regions;
    for (const g of (S.show.una ? (S.cut && S.show.cut ? S.cut.unassigned : S.d.unassigned) : [])) {
      poly(g, true);
      ctx.fillStyle = 'rgba(138,127,216,.16)'; ctx.fill();
      ctx.strokeStyle = css('--una'); ctx.lineWidth = W(1); ctx.stroke();
    }
    for (const reg of src) {
      const on = reg.abbr === S.abbr;
      const moved = S.show.cut && S.cut && S.cut.changed.includes(reg.abbr);
      for (const g of reg.rings) {
        if (g.length < 3) continue;
        poly(g, true);
        if (on || moved) {
          ctx.fillStyle = on ? 'rgba(0,160,106,.22)' : 'rgba(196,0,196,.14)';
          ctx.fill();
        }
        ctx.strokeStyle = on ? css('--sel') : moved ? css('--ext') : 'rgba(42,102,204,.45)';
        ctx.lineWidth = W(on ? 2 : moved ? 1.6 : 0.6);
        ctx.stroke();
      }
    }
  }

  // the tracing
  if (S.show.ink) {
    for (const p of S.paths) {
      ctx.strokeStyle = p.corr ? css('--bound') : css('--trace');
      ctx.lineWidth = W(p.corr ? 2 : 1.1);
      ctx.setLineDash(p.style === 'dashed' ? [W(7), W(4)] : []);
      ctx.stroke(p.p);
    }
    ctx.setLineDash([]);
  }

  // the printed labels: the box, and where it seeds
  if (S.show.lab) {
    for (const L of S.d.labels) {
      const on = L.abbr === S.abbr;
      poly(L.box, true);
      ctx.strokeStyle = on ? css('--accent') : css('--box');
      ctx.lineWidth = W(on ? 1.6 : 0.9); ctx.stroke();
      if (L.led) {
        const c = [(L.box[0][0] + L.box[2][0]) / 2, (L.box[0][1] + L.box[2][1]) / 2];
        ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(L.at[0], L.at[1]);
        ctx.strokeStyle = css('--box'); ctx.lineWidth = W(0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(L.at[0], L.at[1], W(3.5), 0, 7);
        ctx.fillStyle = L.byhand ? css('--seed') : css('--box'); ctx.fill();
      }
    }
  }

  drawMarks();
  if (S.pending) drawPending();
  screen();
  if (S.show.lab) labelText();
  $('zoom').textContent = (S.view.k * 100).toFixed(0) + '%  ·  '
    + (1 / (S.view.k) * S.d.mm_per_px * 1000).toFixed(0) + ' µm/px';
}

function labelText() {
  if (!S.abbr) return;
  const v = S.view;
  ctx.font = '600 11px ui-sans-serif,system-ui,sans-serif';
  ctx.fillStyle = css('--accent');
  for (const L of S.d.labels) {
    if (L.abbr !== S.abbr) continue;
    const x = L.box[0][0] * v.k + v.x, y = L.box[0][1] * v.k + v.y;
    ctx.fillText(L.abbr + '[' + L.index + ']', x, y - 3);
  }
}

function drawMarks() {
  const D = S.draft;
  for (const e of D.extents) {
    poly(e.page_px, true);
    ctx.fillStyle = 'rgba(196,0,196,.12)'; ctx.fill();
    ctx.strokeStyle = css('--ext'); ctx.lineWidth = W(2); ctx.stroke();
  }
  for (const b of D.boundaries) {
    poly(b.page_px, !!b.closed);
    ctx.strokeStyle = css('--bound'); ctx.lineWidth = W(2.5);
    ctx.setLineDash(b.style === 'dashed' ? [W(8), W(5)] : []);
    ctx.stroke(); ctx.setLineDash([]);
    for (const q of [b.page_px[0], b.page_px[b.page_px.length - 1]]) {
      ctx.beginPath(); ctx.arc(q[0], q[1], W(4), 0, 7);
      ctx.strokeStyle = css('--bound'); ctx.lineWidth = W(1.5); ctx.stroke();
    }
  }
  for (const s of D.seeds) {
    const [x, y] = s.page_px, neg = s.kind === 'negative';
    if (neg) {
      ctx.strokeStyle = css('--unseed'); ctx.lineWidth = W(2.5);
      ctx.beginPath();
      ctx.moveTo(x - W(7), y - W(7)); ctx.lineTo(x + W(7), y + W(7));
      ctx.moveTo(x - W(7), y + W(7)); ctx.lineTo(x + W(7), y - W(7));
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(x, y, W(5.5), 0, 7);
      ctx.fillStyle = css('--seed'); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = W(1.6); ctx.stroke();
    }
  }
}

function drawPending() {
  const p = S.pending, pts = p.pts;
  if (!pts.length) return;
  const live = S.at && !p.edit ? pts.concat([S.at]) : pts;
  poly(live, p.kind === 'extent');
  ctx.strokeStyle = p.kind === 'extent' ? css('--ext') : css('--bound');
  ctx.lineWidth = W(2.5);
  ctx.setLineDash(p.kind === 'boundary' && S.opts.style === 'dashed' ? [W(8), W(5)] : []);
  ctx.stroke(); ctx.setLineDash([]);
  if (p.kind === 'extent' && pts.length > 2) { ctx.fillStyle = 'rgba(196,0,196,.10)'; ctx.fill(); }
  for (let i = 0; i < pts.length; i++) {
    ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], W(i === p.hover ? 6 : 4), 0, 7);
    ctx.fillStyle = i === p.hover ? '#fff' : (p.kind === 'extent' ? css('--ext') : css('--bound'));
    ctx.fill();
    ctx.strokeStyle = p.kind === 'extent' ? css('--ext') : css('--bound');
    ctx.lineWidth = W(1.5); ctx.stroke();
  }
}

/* ------------------------------------------------------------------ pointer */

let panFrom = null;
cv.addEventListener('pointerdown', (ev) => {
  if (!S.d) return;
  cv.setPointerCapture(ev.pointerId);
  const at = screenToPage(ev);
  if (ev.button === 1 || ev.button === 2 || ev.shiftKey || S.tool === 'pan') {
    panFrom = {x: ev.clientX, y: ev.clientY, v: Object.assign({}, S.view)};
    document.querySelector('.stage').classList.add('pan');
    return;
  }
  if (ev.button !== 0) return;
  const p = S.pending;
  if (p && p.edit) {                                  // dragging an extent's vertices
    const i = nearVertex(p.pts, at);
    if (i >= 0 && ev.altKey) { if (p.pts.length > 3) p.pts.splice(i, 1); draw(); return; }
    if (i >= 0) { S.drag = {i}; return; }
    const e = nearEdge(p.pts, at);
    if (e >= 0) { p.pts.splice(e + 1, 0, at); S.drag = {i: e + 1}; draw(); return; }
    return;
  }
  if (p) { p.pts.push(at); draw(); return; }           // laying down vertices
  click(at, ev);
});
cv.addEventListener('pointermove', (ev) => {
  if (!S.d) return;
  if (panFrom) {
    S.view = {k: panFrom.v.k, x: panFrom.v.x + (ev.clientX - panFrom.x),
      y: panFrom.v.y + (ev.clientY - panFrom.y)};
    draw(); return;
  }
  const at = screenToPage(ev);
  S.at = at;
  if (S.drag) { S.pending.pts[S.drag.i] = at; draw(); return; }
  if (S.pending && S.pending.edit) {
    const i = nearVertex(S.pending.pts, at);
    if (i !== S.pending.hover) { S.pending.hover = i; draw(); }
  }
  const mm = toMm(at[0], at[1]);
  $('at').textContent = 'ML ' + fmt(mm[0]) + '  DV ' + fmt(mm[1]) + ' mm   ·   page '
    + at[0].toFixed(0) + ', ' + at[1].toFixed(0);
  const reg = regionAt(at[0], at[1]);
  $('under').textContent = reg ? reg.abbr + ' — ' + reg.name : '';
  if (S.pending && !S.pending.edit) draw();
});
cv.addEventListener('pointerup', () => {
  panFrom = null; S.drag = null;
  document.querySelector('.stage').classList.remove('pan');
});
cv.addEventListener('dblclick', (ev) => { ev.preventDefault(); if (S.pending) finish(); });
cv.addEventListener('contextmenu', (ev) => ev.preventDefault());
cv.addEventListener('wheel', (ev) => {
  if (!S.d) return;
  ev.preventDefault();
  const r = cv.getBoundingClientRect(), v = S.view;
  const f = Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0015));
  const k = Math.max(0.02, Math.min(40, v.k * f));
  const mx = ev.clientX - r.left, my = ev.clientY - r.top;
  S.view = {k, x: mx - (mx - v.x) * k / v.k, y: my - (my - v.y) * k / v.k};
  draw();
}, {passive: false});

function nearVertex(pts, at) {
  const r = W(9);
  for (let i = 0; i < pts.length; i++) {
    if (Math.hypot(pts[i][0] - at[0], pts[i][1] - at[1]) < r) return i;
  }
  return -1;
}
function nearEdge(pts, at) {
  const r = W(7);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy;
    const t = L2 ? Math.max(0, Math.min(1, ((at[0] - a[0]) * vx + (at[1] - a[1]) * vy) / L2)) : 0;
    if (Math.hypot(a[0] + t * vx - at[0], a[1] + t * vy - at[1]) < r) return i;
  }
  return -1;
}

async function click(at, ev) {
  if (S.tool === 'pick') {
    const reg = regionAt(at[0], at[1]);
    if (reg && !ev.altKey) select(reg.abbr);
    await probe(at);
    return;
  }
  if (S.tool === 'seed' || S.tool === 'unseed') {
    if (!S.abbr) { toast('Choose the region first', true); return; }
    const mm = toMm(at[0], at[1]);
    const s = {abbr: S.abbr, kind: S.tool === 'seed' ? 'positive' : 'negative',
      page_px: [round2(at[0]), round2(at[1])], mm: [round3(mm[0]), round3(mm[1])], note: ''};
    if (S.tool === 'seed' && S.opts.replaces !== null) s.label_index = S.opts.replaces;
    S.draft.seeds.push(s);
    renderMarks(); draw();
    await probe(at);
    return;
  }
  if (S.tool === 'boundary') { S.pending = {kind: 'boundary', pts: [at]}; draw(); hintFor(); return; }
  if (S.tool === 'extent') { S.pending = {kind: 'extent', pts: [at]}; draw(); hintFor(); }
}

const round2 = (v) => Math.round(v * 100) / 100;
const round3 = (v) => Math.round(v * 1000) / 1000;

async function probe(at) {
  try {
    const r = await api('/api/probe', {plate: S.plate, at: [at[0], at[1]], draft: S.draft});
    const face = r.face
      ? 'face #' + r.face + ' of ' + r.face_px + ' px (' + r.face_mm2.toFixed(3) + ' mm²), '
        + (r.names.length ? 'seeded by ' + r.names.join(', ') : 'seeded by no printed label')
      : 'no face here (on a traced line, or outside the section)';
    report('ML ' + fmt(r.mm[0], 3) + '  DV ' + fmt(r.mm[1], 3) + ' mm   page ' + r.page_px.join(', ')
      + '\n  ' + face
      + '\n  today: ' + (r.owner ? 'inside ' + r.owner : 'in no region')
      + '\n  nearest traced ink: ' + r.ink_px + ' page px'
      + (r.face && r.names.length === 1 && r.names[0] !== S.abbr && S.abbr
        ? '\n  -> the atlas letters this face ' + r.names[0] + ' alone: a seed here would split it.'
          + ' Look for a boundary the tracing missed.' : '')
      + (r.face && !r.names.length ? '\n  -> an unlettered face: a seed names it.' : ''));
  } catch (e) { report(String(e.message), true); }
}

function finish() {
  const p = S.pending;
  if (!p) return;
  if (p.kind === 'boundary') {
    if (p.pts.length < 2) { S.pending = null; draw(); return; }
    S.draft.boundaries.push({style: S.opts.style, closed: S.opts.closed,
      page_px: p.pts.map((q) => [round2(q[0]), round2(q[1])]),
      mm: p.pts.map((q) => toMm(q[0], q[1]).map(round3)), note: ''});
  } else {
    if (p.pts.length < 3) { S.pending = null; draw(); return; }
    S.draft.extents.push({abbr: p.abbr || S.abbr,
      page_px: p.pts.map((q) => [round2(q[0]), round2(q[1])]),
      mm: p.pts.map((q) => toMm(q[0], q[1]).map(round3)), note: ''});
  }
  S.pending = null;
  renderMarks(); draw(); hintFor();
}

/* --------------------------------------------------------------------- side */

function renderRegions() {
  const q = $('find').value.trim().toLowerCase();
  const here = new Map(S.d.regions.map((r) => [r.abbr, r]));
  const boxes = new Set(S.d.labels.map((L) => L.abbr));
  const list = S.boot.structures.filter((s) =>
    !q || s.abbr.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  const rank = (s) => (here.has(s.abbr) ? 0 : boxes.has(s.abbr) ? 1 : 2);
  list.sort((a, b) => rank(a) - rank(b) || a.abbr.localeCompare(b.abbr));
  const el = $('regions');
  el.innerHTML = '';
  for (const s of list.slice(0, 300)) {
    const r = here.get(s.abbr);
    const row = document.createElement('div');
    row.className = 'row' + (r ? '' : ' off') + (s.abbr === S.abbr ? ' on' : '');
    row.innerHTML = '<span class="ab"></span><span class="nm"></span><span class="ar"></span>';
    row.children[0].textContent = s.abbr;
    row.children[1].textContent = s.name;
    row.children[2].textContent = r ? r.area.toFixed(3) + ' mm²'
      : boxes.has(s.abbr) ? 'printed, no area' : '';
    row.onclick = () => select(s.abbr);
    el.appendChild(row);
  }
}

function select(abbr) {
  S.abbr = abbr; S.draft.abbr = abbr;
  renderRegions(); selectFacts(); renderOpts(); draw();
  const el = $('regions').querySelector('.row.on');
  if (el) el.scrollIntoView({block: 'nearest'});
}

function selectFacts() {
  const el = $('regfact');
  if (!S.abbr) { el.textContent = 'Nothing chosen yet.'; return; }
  const r = S.d.regions.find((x) => x.abbr === S.abbr);
  const boxes = S.d.labels.filter((L) => L.abbr === S.abbr);
  const bits = [];
  bits.push(r ? r.area.toFixed(4) + ' mm² in ' + r.rings.length + ' ring'
    + (r.rings.length === 1 ? '' : 's') + ', traced share '
    + r.traced.map((v) => v.toFixed(2)).join(', ') + (r.w ? ' — no outline of its own (w)' : '')
    : 'no area on this plate');
  bits.push('printed ' + boxes.length + ' time' + (boxes.length === 1 ? '' : 's')
    + (boxes.length ? ': ' + boxes.map((L) => L.abbr + '[' + L.index + ']'
      + (L.led ? ' (on a line)' : '')).join(', ') : ''));
  el.textContent = bits.join(' · ');
  if (r) {
    const btn = document.createElement('button');
    btn.className = 'b'; btn.textContent = 'Zoom to it'; btn.style.marginTop = '5px';
    btn.onclick = () => zoomTo([].concat(...r.rings));
    el.appendChild(document.createElement('br')); el.appendChild(btn);
  }
}

function renderOpts() {
  const el = $('opts');
  el.innerHTML = '';
  const add = (html) => { const d = document.createElement('div'); d.className = 'grp wrap'; d.innerHTML = html; el.appendChild(d); return d; };
  if (S.tool === 'boundary') {
    const d = add('<div class="seg"><button type="button" data-s="solid">solid</button>'
      + '<button type="button" data-s="dashed">dashed</button></div>'
      + '<label class="chk"><input type="checkbox" id="o-closed"> a ring</label>');
    for (const b of d.querySelectorAll('[data-s]')) {
      b.className = b.dataset.s === S.opts.style ? 'on' : '';
      b.onclick = () => { S.opts.style = b.dataset.s; renderOpts(); draw(); };
    }
    const c = d.querySelector('#o-closed');
    c.checked = S.opts.closed;
    c.onchange = () => { S.opts.closed = c.checked; draw(); };
  } else if (S.tool === 'seed') {
    const boxes = S.d ? S.d.labels.filter((L) => L.abbr === S.abbr) : [];
    let html = '<label class="chk" style="gap:6px">stands in for <select id="o-rep" style="width:auto">'
      + '<option value="">no box — a seed of its own</option>';
    for (const L of boxes) html += '<option value="' + L.index + '">' + S.abbr + '[' + L.index + ']</option>';
    html += '</select></label>';
    const d = add(html);
    const sel = d.querySelector('#o-rep');
    sel.value = S.opts.replaces === null ? '' : String(S.opts.replaces);
    sel.onchange = () => { S.opts.replaces = sel.value === '' ? null : Number(sel.value); };
  } else if (S.tool === 'extent') {
    const r = S.d ? S.d.regions.find((x) => x.abbr === S.abbr) : null;
    if (r) {
      const d = add('');
      r.rings.forEach((g, i) => {
        const b = document.createElement('button');
        b.className = 'b';
        const c = g.reduce((a, q) => [a[0] + q[0] / g.length, a[1] + q[1] / g.length], [0, 0]);
        const ml = toMm(c[0], c[1])[0];
        b.textContent = 'Pull ring ' + (i + 1) + ' into shape (' + (ml < 0 ? 'left' : 'right') + ')';
        b.onclick = () => {
          S.pending = {kind: 'extent', pts: g.map((q) => q.slice()), edit: true, abbr: S.abbr};
          zoomTo(g); hintFor();
        };
        d.appendChild(b);
      });
    }
  }
  hintFor();
}

const HINTS = {
  pick: 'Click the plate to read what the extraction has there — the face, what seeds it, and which region holds the point today.',
  seed: 'Click where <b>{a}</b> is. Without a box named above it is a seed of its own; with one, that printed box withdraws and this stands in for it.',
  unseed: 'Click where <b>{a}</b> is <b>not</b>. A negative seed is for the reader, not the pipeline.',
  boundary: 'Click along the run of boundary the tracing missed; <b>double-click</b> or <b>Enter</b> to finish, <b>Backspace</b> to drop a vertex, <b>Esc</b> to cancel. Draw its ends onto the traced ink — the pipeline only bridges {b} page px.',
  extent: 'Pull the region’s own ring into shape, or click a fresh outline. Drag a vertex, click an edge to add one, <b>alt-click</b> to delete one; <b>Enter</b> accepts.',
};
function hintFor() {
  let t = HINTS[S.tool] || '';
  if (S.pending) {
    t = S.pending.edit
      ? 'Drag the vertices into place; click an edge to add one, alt-click one to delete it. <b>Enter</b> accepts, <b>Esc</b> drops it.'
      : (S.pending.pts.length + ' vertex' + (S.pending.pts.length === 1 ? '' : 'es') + ' so far. ')
        + '<b>Double-click</b> or <b>Enter</b> to finish, <b>Backspace</b> to drop the last, <b>Esc</b> to cancel.';
  }
  $('hint').innerHTML = t.replace('{a}', S.abbr || 'the region').replace('{b}', S.d ? S.d.bridge_px : 20);
}

function renderMarks() {
  const D = S.draft, el = $('marks');
  el.innerHTML = '';
  const add = (color, head, sub, drop, go) => {
    const d = document.createElement('div');
    d.className = 'mark';
    d.innerHTML = '<span class="sw"></span><span class="txt"><span></span><em></em></span>'
      + '<button class="x" type="button" title="Drop this mark">×</button>';
    d.children[0].style.background = color;
    d.children[1].children[0].textContent = head;
    d.children[1].children[1].textContent = sub;
    d.children[2].onclick = drop;
    if (go) d.children[1].onclick = go;
    if (go) d.children[1].style.cursor = 'zoom-in';
    el.appendChild(d);
  };
  D.seeds.forEach((s, i) => add(s.kind === 'negative' ? css('--unseed') : css('--seed'),
    s.abbr + ' ' + s.kind + (s.label_index !== undefined ? ' (for box ' + s.label_index + ')' : ''),
    'ML ' + fmt(s.mm[0], 3) + '  DV ' + fmt(s.mm[1], 3) + (s.note ? ' — ' + s.note : ''),
    () => { D.seeds.splice(i, 1); renderMarks(); draw(); },
    () => zoomTo([s.page_px], 200)));
  D.boundaries.forEach((b, i) => add(css('--bound'),
    b.style + ' boundary' + (b.closed ? ', a ring' : ''),
    b.page_px.length + ' points' + (b.note ? ' — ' + b.note : ''),
    () => { D.boundaries.splice(i, 1); renderMarks(); draw(); },
    () => zoomTo(b.page_px)));
  D.extents.forEach((e, i) => add(css('--ext'),
    e.abbr + ' extent', e.page_px.length + ' vertices' + (e.note ? ' — ' + e.note : ''),
    () => { D.extents.splice(i, 1); renderMarks(); draw(); },
    () => zoomTo(e.page_px)));
  D.notes.forEach((n, i) => add(css('--muted'), 'note', n,
    () => { D.notes.splice(i, 1); renderMarks(); }));
  if (!D.seeds.length && !D.boundaries.length && !D.extents.length && !D.notes.length) {
    const d = document.createElement('div');
    d.className = 'mark empty';
    d.textContent = 'Nothing marked yet.';
    el.appendChild(d);
  }
  $('commitb').disabled = !(D.seeds.length || D.boundaries.length || D.extents.length);
}

/* ------------------------------------------------------------------ actions */

function draftNow() { S.draft.problem = $('problem').value; return S.draft; }

async function inspect(qc) {
  try {
    const r = await api('/api/inspect', {draft: draftNow(), qc: !!qc});
    report(r.lines.join('\n'));
    if (r.qc) toast('wrote ' + r.qc);
  } catch (e) { report(String(e.message), true); toast(e.message, true); }
}

async function recut() {
  try {
    report('cutting the plate again with the correction applied — about ten seconds…');
    const r = await api('/api/recut', {draft: draftNow()});
    S.cut = r;
    $('v-cut').disabled = false; $('v-cut').checked = true; S.show.cut = true;
    report(r.lines.join('\n'));
    draw();
    toast(r.changed.length ? 'the recut moves ' + r.changed.join(', ') : 'the recut moves nothing');
  } catch (e) { report(String(e.message), true); toast(e.message, true); }
}

function sheet(title, bodyHTML, buttons) {
  $('mtitle').textContent = title;
  $('mbody').innerHTML = bodyHTML;
  const b = $('mbtns');
  b.innerHTML = '';
  for (const [label, fn, cls] of buttons) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'b ' + (cls || ''); el.textContent = label;
    el.onclick = fn;
    b.appendChild(el);
  }
  $('modal').hidden = false;
  const first = $('mbody').querySelector('input,textarea');
  if (first) first.focus();
}
const closeSheet = () => { $('modal').hidden = true; };

async function commit() {
  const D = draftNow();
  if (!D.abbr) { toast('Choose the region first', true); return; }
  if (!D.problem.trim()) { toast('Say what is wrong first', true); return; }
  let pre;
  try { pre = await api('/api/document', {draft: D}); }
  catch (e) { report(String(e.message), true); toast(e.message, true); return; }

  const send = async () => {
    const dry = $('m-dry').checked;
    const snap = $('m-snap').checked ? cv.toDataURL('image/png') : null;
    closeSheet();
    try {
      const r = await api('/api/commit', {draft: D, png: snap, dry});
      report(r.json);
      if (r.dry) { toast('wrote ' + r.path); return; }
      sheet('Pushed ' + r.id,
        '<p>The branch is <code>' + r.branch + '</code>.</p>'
        + (r.url ? '<p><a href="' + r.url + '" target="_blank" rel="noreferrer">the branch</a>'
          + ' · <a href="' + r.actions + '" target="_blank" rel="noreferrer">the workflow</a></p>' : '')
        + '<p>A session now reads it with <code>tools/corrections.py inspect</code>, fixes the '
        + 'input at fault, rebuilds, and opens a pull request.</p>', [['Close', closeSheet]]);
    } catch (e) { report(String(e.message), true); toast(e.message, true); }
  };

  sheet('Send this correction',
    '<p id="m-what"></p><pre id="mjson"></pre>'
    + '<label class="chk"><input type="checkbox" id="m-snap" checked>'
    + ' commit a picture of the plate as it stands beside it</label>'
    + '<label class="chk"><input type="checkbox" id="m-dry">'
    + ' dry run — write it under build/corrections/ and stop</label>',
    [['Cancel', closeSheet], ['Commit and push', send, 'go']]);
  $('mjson').textContent = pre.text;
  const btn = $('mbtns').lastChild;
  const mode = () => {
    const dry = $('m-dry').checked;
    btn.textContent = dry ? 'Write it' : 'Commit and push';
    $('m-what').innerHTML = dry
      ? 'A dry run writes the file under <code>build/corrections/</code> and stops, '
        + 'which is the way to look at what would be sent.'
      : 'The file goes on a branch <code>correction/&lt;id&gt;</code> cut from '
        + '<code>origin/main</code> in a temporary worktree, and the push starts '
        + '<code>apply-correction.yml</code>. Your own checkout is not touched.';
  };
  $('m-dry').onchange = mode;
  mode();
}

async function save() {
  sheet('Save the draft', '<p>A draft is a correction file like any other; '
    + '<code>--draft</code> reads it back.</p><input id="m-path" value="'
    + 'build/drafts/draft.json">', [['Cancel', closeSheet], ['Save', async () => {
      const p = $('m-path').value.trim(); closeSheet();
      try {
        const r = await api('/api/save', {draft: draftNow(), path: p});
        toast('wrote ' + r.path);
      } catch (e) { toast(e.message, true); }
    }, 'go']]);
}

async function open_() {
  sheet('Open a draft or a correction',
    '<p>Any <code>gerbil-atlas-correction/1</code> file: a draft you saved, or one in '
    + '<code>corrections/</code>.</p><input id="m-path" placeholder="corrections/&lt;id&gt;.json">',
    [['Cancel', closeSheet], ['Open', async () => {
      const p = $('m-path').value.trim(); closeSheet();
      try {
        const r = await api('/api/open', {path: p});
        await useDraft(r.draft);
        toast('read ' + p);
      } catch (e) { toast(e.message, true); }
    }, 'go']]);
}

async function useDraft(d) {
  const n = Number(d.plate) || S.plate;
  if (n !== S.plate) await loadPlate(n);
  S.draft = Object.assign({plate: n, abbr: '', problem: '', seeds: [], boundaries: [],
    extents: [], notes: []}, d);
  S.draft.plate = n;
  for (const k of ['seeds', 'boundaries', 'extents', 'notes']) S.draft[k] = S.draft[k] || [];
  $('problem').value = S.draft.problem || '';
  if (S.draft.abbr) select(S.draft.abbr);
  renderMarks();
  draw();
}

/* -------------------------------------------------------------------- wiring */

function setTool(t) {
  if (S.pending) { S.pending = null; draw(); }
  S.tool = t;
  for (const b of $('toolseg').children) b.classList.toggle('on', b.dataset.t === t);
  renderOpts();
}

function wire() {
  for (const b of $('toolseg').children) b.onclick = () => setTool(b.dataset.t);
  $('find').oninput = renderRegions;
  $('plate').onchange = () => { const n = Number($('plate').value); if (n >= 1 && n <= 62) loadPlate(n); };
  $('prev').onclick = () => { if (S.plate > 1) loadPlate(S.plate - 1); };
  $('next').onclick = () => { if (S.plate < 62) loadPlate(S.plate + 1); };
  $('fit').onclick = fit;
  $('inspectb').onclick = () => inspect(false);
  $('qcb').onclick = () => inspect(true);
  $('recutb').onclick = recut;
  $('saveb').onclick = save;
  $('openb').onclick = open_;
  $('commitb').onclick = () => commit();
  $('undob').onclick = undo;
  $('clearb').onclick = () => {
    S.draft.seeds = []; S.draft.boundaries = []; S.draft.extents = [];
    S.pending = null; renderMarks(); draw();
  };
  $('noteb').onclick = () => sheet('A note on this correction',
    '<p>Anything else worth saying to whoever applies it.</p><textarea id="m-note" rows="3"></textarea>',
    [['Cancel', closeSheet], ['Add', () => {
      const t = $('m-note').value.trim(); closeSheet();
      if (t) { S.draft.notes.push(t); renderMarks(); }
    }, 'go']]);
  for (const [id, key] of [['v-ink', 'ink'], ['v-ext', 'ext'], ['v-lab', 'lab'],
    ['v-una', 'una'], ['v-cut', 'cut']]) {
    $(id).onchange = () => { S.show[key] = $(id).checked; draw(); };
  }
  $('modal').onclick = (ev) => { if (ev.target === $('modal')) closeSheet(); };
  window.addEventListener('resize', resize);
  document.addEventListener('keydown', key);
}

function undo() {
  const D = S.draft;
  if (S.pending && S.pending.pts.length > 1 && !S.pending.edit) { S.pending.pts.pop(); draw(); hintFor(); return; }
  if (S.pending) { S.pending = null; draw(); hintFor(); return; }
  for (const k of ['extents', 'boundaries', 'seeds', 'notes']) {
    if (D[k].length) { D[k].pop(); renderMarks(); draw(); return; }
  }
}

function key(ev) {
  if (ev.target.matches('input,textarea,select')) {
    if (ev.key === 'Escape') ev.target.blur();
    return;
  }
  const k = ev.key;
  if (k === 'Escape') { if (!$('modal').hidden) closeSheet(); else if (S.pending) { S.pending = null; draw(); hintFor(); } return; }
  if (!$('modal').hidden) return;
  if (k === 'Enter') { finish(); return; }
  if (k === 'Backspace') { ev.preventDefault(); undo(); return; }
  const tools = {1: 'pick', 2: 'seed', 3: 'unseed', 4: 'boundary', 5: 'extent'};
  if (tools[k]) { setTool(tools[k]); return; }
  if (k === 'f') fit();
  else if (k === 'z') undo();
  else if (k === 'i') inspect(false);
  else if (k === 'r') recut();
  else if (k === 's') save();
  else if (k === ',') { if (S.plate > 1) loadPlate(S.plate - 1); }
  else if (k === '.') { if (S.plate < 62) loadPlate(S.plate + 1); }
  else if (k === 'l') {
    const i = S.d.layers.indexOf(S.layer);
    S.layer = S.d.layers[(i + 1) % S.d.layers.length];
    layerSeg(); loadImage();
  }
}

(async function start() {
  try {
    S.boot = await api('/api/boot');
    wire();
    const st = S.boot.start;
    S.layer = st.layer || 'drawing';
    await loadPlate(st.plate);
    resize();
    if (st.draft) await useDraft(st.draft);
    else if (st.abbr) select(st.abbr);
    document.title = 'Plate ' + S.plate + ' — atlas region fixer';
  } catch (e) {
    report('the server did not answer: ' + e.message, true);
  }
})();
