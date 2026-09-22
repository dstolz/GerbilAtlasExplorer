/* The atlas region fixer, in the browser: tools/atlasfix.py serves this page and
   answers for it. Everything drawn here is in the page frame the tracings in svg/
   are in (3296 x 2481 px, portrait on plate 20), which is the frame a correction
   is written in; millimetres are computed from it for the reader, through the same
   two transforms tools/atlaslib.py uses -- the plate's registration matrix and
   plate_frame -- so what the status bar says is what the file will say.

   Plate 20's page is the one printed at a quarter turn, and the view undoes it: the
   section is drawn upright, as the atlas draws it and as the app shows it, while the
   page frame underneath is untouched. Nothing a correction carries is rotated.

   A draft belongs to the plate it was made on -- its marks are that page's pixels and
   the millimetres beside them are read through that plate's registration -- so the
   plate that is put down keeps its marks and hands them back when it comes up again.
   Commit sends all of them: every plate that holds marks, and on each plate one file
   for each region marked on it, as one commit on one branch, so a reader who walks
   the atlas marking what is wrong presses the button once.

   The marks are a seed for the name a face should carry, a run of boundary the tracing
   missed, and the outline a region should have. A region is one extent for each place
   the atlas draws it, and an extent carries a kind: positive is an outline the region
   should have, negative says it has none of the area drawn round -- the hole in a
   ring-like region, or a ring the extraction gave it and the atlas does not. Nothing
   here edits region_extents; a correction is one edit to a pipeline input, and the
   extents are re-cut from it.

   A leader is the fourth: where a printed label seeds. The atlas prints a label that
   will not fit inside its region outside it, with a line drawn back in, and the region
   is seeded at the end of that line. Moving the end is a seed carrying the label's
   `label_index` -- the same entry tools/corrections.py has always read as standing in
   for that printed box -- so the leader tool writes nothing the schema did not already
   say. */
'use strict';

const $ = (id) => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);

const blankDraft = (n) => ({plate: n, abbr: '', problem: '', seeds: [], boundaries: [],
  extents: [], notes: []});

const S = {
  boot: null, plate: 0, want: 0, d: null, paths: [], img: null, imgM: null, layer: 'drawing',
  abbr: '', tool: 'pick', view: {k: 1, x: 0, y: 0}, rot: [1, 0, 0, 1, 0, 0],
  at: null, pending: null,
  drag: null, cut: null, busy: 0, fitted: false,
  opts: {style: 'solid', closed: false, hemi: '', extkind: 'positive', snap: true},
  show: {ink: true, ext: true, lab: true, una: false, cut: false},
  draft: blankDraft(0),
  drafts: new Map(),                    // plate -> the draft made on it, kept while it is away
  hist: new Map(),                      // plate -> its draft's marks before each change, for Undo
  ink: null,                            // the plate's traced ink, indexed for snapping
  hover: null,                          // what a press where the pointer is would take hold of
  snapAt: null,                         // where the next point would land, when it snaps
  lead: null,                           // the label chosen under the leader tool
  hi: null,                             // the mark whose row the pointer is over
};

/* ------------------------------------------------------------------ frames */

const xf = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const mul6 = (A, B) => [                    // A after B, both [a, b, c, d, e, f]
  A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];

function inv6(m) {
  const det = m[0] * m[3] - m[1] * m[2];
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}

/* The turn to draw a page upright.

   The atlas prints plate 20 sideways: its page is 2481 x 3296 where every other plate's
   is 3296 x 2481, and the registration matrix that carries the page into the plate
   frame is a quarter turn rather than a plain scale. Drawn as it is stored, the section
   lies on its side -- which is not the plate anyone is reading, and not what the app
   shows. So the view is composed with the same quarter turn, snapped to a right angle
   so no scale or skew of the fit leaks into it: the plate comes up the way it is
   printed in the book, and the page frame beneath it is untouched. Every page_px a
   correction carries is still the page's own, so corrections/ and tools/corrections.py
   never see this. The identity on the other 61 plates. */
function quarterTurn(m, w, h) {
  const z = (v) => v || 0;                              // and no negative zero in it
  const q = ((Math.round(Math.atan2(m[1], m[0]) / (Math.PI / 2)) % 4) + 4) % 4;
  const c = [1, 0, -1, 0][q], sn = [0, 1, 0, -1][q];     // cos and sin of q right angles
  const R = [c, sn, z(-sn), c, 0, 0];
  let x0 = Infinity, y0 = Infinity;
  for (const [x, y] of [[0, 0], [w, 0], [w, h], [0, h]]) {
    const at = xf(R, x, y);
    x0 = Math.min(x0, at[0]); y0 = Math.min(y0, at[1]);
  }
  R[4] = z(-x0); R[5] = z(-y0);                          // the turned page starts at 0, 0
  return R;
}
// page px -> canvas px: the plate set upright, then the view's own zoom and pan
function viewM() { const v = S.view; return mul6([v.k, 0, 0, v.k, v.x, v.y], S.rot); }
// canvas px -> the upright frame the view zooms and pans in, short of the page itself
function viewOf(pt) { const v = S.view; return [(pt[0] - v.x) / v.k, (pt[1] - v.y) / v.k]; }

function toMm(x, y, on) {                   // page px -> [ML, DV] mm, on screen unless `on` says
  const P = on || S.d, f = P.frame, p = xf(P.m, x, y);
  return [(p[0] - f.ml0) / f.mlpx, (f.dv0 - p[1]) / f.dvpx];
}
function toPage(ml, dv) {                   // [ML, DV] mm -> page px
  const f = S.d.frame;
  return xf(S.d.im, f.ml0 + ml * f.mlpx, f.dv0 - dv * f.dvpx);
}
const frameOf = (pf) => ({w: pf.width_px, h: pf.height_px, ml0: pf.ml_zero_px,
  mlpx: pf.ml_px_per_mm, dv0: pf.dv_zero_px, dvpx: pf.dv_px_per_mm});

/* The transforms plate n's page px are read through. A mark is only ever made on the
   plate on screen, but its file is written when Commit is pressed, and one Commit writes
   every plate that holds marks -- so each file is read through its own plate's
   registration, not the one in front of the reader. Sixty plates' registrations lie within
   0.016 mm of one another, which is how reading them through the wrong one went unseen;
   plate 31's sits 0.83 mm of DV from the rest (#135), and plate 20's is a quarter turn.
   The published page has every plate's in the database; behind tools/atlasfix.py the
   server writes the file, through the plate it names. */
function framesOf(n) {
  if (n === S.plate && S.d) return S.d;
  const m = DB && DB.plate_registration.data[String(n)];
  if (!m) throw new Error('plate ' + n + ': no registration to read its marks in mm');
  return {m, frame: frameOf(DB.plate_frame)};
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

/* ---------------------------------------------------------------- backends
 *
 * The same page, two ways of answering it.
 *
 * `Local` is tools/atlasfix.py behind /api: it has the repository and the pipeline, so
 * Pick, Inspect and Recut are the extraction's own answers and Commit pushes a branch
 * through git.
 *
 * `Static` is the copy GitHub Pages serves, with no server behind it at all. It draws
 * from what the site already publishes -- the database, the tracings, the plates -- and
 * answers Pick from `data/facemaps/`, which tools/build_facemaps.py cuts with the
 * pipeline and CI checks is a fresh cut, so that answer is not a re-implementation
 * either. What it cannot do is run the pipeline: Inspect and Recut need
 * build_region_extents, so they are off, and Commit goes through the GitHub API with a
 * token you supply rather than through git.
 *
 * Which one is in hand is settled by a marker: tools/atlasfix.py writes
 * `window.__ATLASFIX_LOCAL__` into the page it serves, and the copy Pages serves has
 * none. Asking /api/boot and seeing whether it 404s would do as well, but it would log
 * a failed request on every load of the published page. */

const SRC = {};
const REPO = {owner: 'dstolz', repo: 'GerbilAtlasExplorer', base: 'main'};

function pickBackend() {
  if (window.__ATLASFIX_LOCAL__) {
    Object.assign(SRC, Local);
    return api('/api/boot');
  }
  Object.assign(SRC, Static);
  return Static.boot();
}

const Local = {
  plate: (n) => api('/api/plate/' + n),
  image: (layer, n) => '/api/image/' + layer + '/' + n + '.jpg',
  probe: (plate, at, draft) => api('/api/probe', {plate, at, draft}),
  document: (draft) => api('/api/document', {draft}),
  inspect: (draft, qc) => api('/api/inspect', {draft, qc}),
  recut: (draft) => api('/api/recut', {draft}),
  save: (draft, path) => api('/api/save', {draft, path}),
  open: (path) => api('/api/open', {path}),
  commit: (items, dry) => api('/api/commit', {items, dry}),
  pipeline: true,
};

/* ------------------------------------------------------- the published page */

const BASE = location.pathname.replace(/[^/]*$/, '');
let DB = null;                          // data/gerbil_atlas.json, fetched once
const FACES = new Map();                // plate -> {ids, sizes, labels, page}

/* The build this page was made in, which its requests for data/ carry.
 *
 * sw.js caches everything under data/ cache-first and names the cache for the build it
 * was filled for; a new build is a new worker, and activating it drops the old cache.
 * But only index.html registers that worker, so a reader who opens this page and not
 * the atlas can still be on one from an older build -- and would be handed that
 * build's database under this build's face maps, which is one plate drawn from two
 * cuts. A query string the old cache has never seen misses it and goes to the network,
 * so the answer is one build's throughout; and because the query is the build and not
 * the moment, a second visit inside the same build is still served from the cache.
 *
 * Empty where the page is served by tools/atlasfix.py, which leaves the token in place
 * and does not use this backend anyway. */
const BUILD = (() => {
  const m = document.querySelector('meta[name="gae-build"]');
  const v = ((m && m.content) || '').trim().split(/\s+/)[0];
  return /^[0-9a-zA-Z-]{4,40}$/.test(v) ? v : '';
})();

async function grab(rel, how) {
  // the plate images are not versioned: they are the atlas's own scans, the same in
  // every build, and 186 of them is not a download to spend on a stamp
  const url = BASE + rel + (BUILD && rel.startsWith('data/') ? '?v=' + BUILD : '');
  const r = await fetch(url);
  if (!r.ok) throw new Error(rel + ': ' + r.status);
  return how === 'text' ? r.text() : how === 'buf' ? r.arrayBuffer() : r.json();
}

// M/C/Z, absolute -- the one grammar build_region_extents.flatten reads and the tracer
// writes. Kept to the same cut of a cubic, so a distance measured here is the one the
// pipeline would measure.
function flattenD(d) {
  const t = d.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  const pts = [];
  let cur = null, i = 0;
  while (i < t.length) {
    if (t[i] === 'M') { cur = [+t[i + 1], +t[i + 2]]; pts.push(cur); i += 3; }
    else if (t[i] === 'C') {
      const p0 = cur, p1 = [+t[i + 1], +t[i + 2]], p2 = [+t[i + 3], +t[i + 4]],
        p3 = [+t[i + 5], +t[i + 6]];
      const chord = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
      const n = Math.max(2, Math.min(32, Math.floor(chord / 3) + 2));
      for (let k = 1; k <= n; k++) {
        const u = k / n, v = 1 - u;
        pts.push([v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
          v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]);
      }
      cur = p3; i += 7;
    } else i += 1;
  }
  return pts;
}

const Static = {
  pipeline: false,

  async boot() {
    DB = await grab('data/gerbil_atlas.json');
    const q = new URLSearchParams(location.search);
    const plate = Math.min(62, Math.max(1, Number(q.get('plate')) || 19));
    return {
      tool: 'atlasfix (the published page)',
      plates: DB.plates.map((p) => ({plate: p.plate, bregma: p.bregma})),
      structures: DB.structures.map((s) => ({abbr: s.abbr, name: s.name}))
        .sort((a, b) => a.abbr.localeCompare(b.abbr)),
      features: (DB.features && DB.features.data) || [],
      layers: ['drawing', 'nissl', 'myelin', 'mri'],
      author: (() => { try { return localStorage.getItem('atlasfix.author') || ''; } catch (e) { return ''; } })(),
      start: {plate, abbr: q.get('abbr') || '', layer: q.get('layer') || 'drawing', draft: null},
      repo: REPO.owner + '/' + REPO.repo,
      remote: 'https://github.com/' + REPO.owner + '/' + REPO.repo,
      commit: (DB.version && DB.version.commit) || '',
    };
  },

  image: (layer, n) => BASE + 'data/plates/' + layer + '/' + String(n).padStart(2, '0') + '.jpg',

  async plate(n) {
    const p = String(n);
    const svg = await grab('svg/GerbilAtlas_Plate_' + String(n).padStart(2, '0') + '.svg', 'text');
    const vb = /viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number);
    const W = Math.round(vb[2]), H = Math.round(vb[3]);
    const m = DB.plate_registration.data[p];
    const im = inv6(m);
    const pf = DB.plate_frame;
    const NW = pf.width_px, NH = pf.height_px;
    const toPage = (fx, fy) => {
      const x = fx * NW, y = fy * NH;
      return [Math.round((im[0] * x + im[2] * y + im[4]) * 10) / 10,
        Math.round((im[1] * x + im[3] * y + im[5]) * 10) / 10];
    };
    const paths = [];
    for (const g of svg.split('<g ').slice(1)) {
      const gid = (/id="([^"]+)"/.exec(g) || [])[1] || '';
      const style = gid.includes('dashed') ? 'dashed' : 'solid';
      for (const el of g.split('<path').slice(1)) {
        const head = el.slice(0, el.indexOf('>'));
        const d = (/\bd="([^"]+)"/.exec(head) || [])[1];
        if (!d) continue;
        const corr = (/data-correction="([^"]+)"/.exec(head) || [])[1] || null;
        paths.push({d, style, corr});
      }
    }
    const names = {};
    for (const s of DB.structures) names[s.abbr] = s.name;
    const ext = DB.region_extents.data[p] || {};
    const regions = Object.keys(ext).sort().map((ab) => ({
      abbr: ab, name: names[ab] || ab, area: ext[ab].a, traced: ext[ab].s || [],
      n: ext[ab].n || 0, w: !!ext[ab].w,
      rings: ext[ab].g.map((g) => g.map(([x, y]) => toPage(x, y))),
    }));
    const labels = [];
    const lp = (DB.label_positions.data[p]) || {};
    const lead = ((DB.label_leaders || {}).data || {})[p] || {};
    const over = ((DB.seed_overrides || {}).data || {})[p] || {};
    for (const ab of Object.keys(lp).sort()) {
      const tips = {};
      for (const [i, x, y] of (lead[ab] || [])) tips[i] = [x, y];
      const hand = {};
      for (const row of (over[ab] || [])) if (row[0] >= 0) hand[row[0]] = [row[1], row[2]];
      lp[ab].forEach(([cx, cy, bw, bh], j) => {
        const at = hand[j] || tips[j];
        labels.push({abbr: ab, index: j,
          box: [toPage(cx - bw / 2, cy - bh / 2), toPage(cx + bw / 2, cy - bh / 2),
            toPage(cx + bw / 2, cy + bh / 2), toPage(cx - bw / 2, cy + bh / 2)],
          at: toPage(...(at || [cx, cy])), led: !!at, byhand: j in hand});
      });
    }
    const det = Math.abs(m[0] * m[3] - m[1] * m[2]);
    const mm2 = det / (pf.ml_px_per_mm * pf.dv_px_per_mm);
    return {
      plate: n, bregma: (DB.plates.find((q) => q.plate === n) || {}).bregma,
      page: [W, H], m, im,
      frame: frameOf(pf),
      mm_per_px: Math.sqrt(mm2), mm2_per_px: mm2,
      // the floor under a face is the face map's own (probe reports it); a copy of the
      // constant here went stale when the pipeline's came down from 400 to 100
      bridge_px: 20, min_face_px: null, support_px: 3,
      paths,
      outline: (DB.brain_outline.data[p] || []).map((g) => g.map(([x, y]) => toPage(x, y))),
      regions,
      unassigned: (DB.region_extents.unassigned[p] || []).map((g) => g.map(([x, y]) => toPage(x, y))),
      labels, layers: ['drawing', 'mri', 'myelin', 'nissl'],
    };
  },

  // The face map as tools/build_facemaps.py cut it: the pipeline's own answer, read
  // rather than recomputed. Fetched once a plate and kept.
  async faces(n) {
    if (FACES.has(n)) return FACES.get(n);
    const nn = String(n).padStart(2, '0');
    const [meta, gz] = await Promise.all([
      grab('data/facemaps/plate_' + nn + '.json'),
      grab('data/facemaps/plate_' + nn + '.u16.gz', 'buf'),
    ]);
    let bytes = new Uint8Array(gz);
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {        // still gzipped: inflate it
      const ds = new DecompressionStream('gzip');
      const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
      bytes = new Uint8Array(buf);
    }
    const out = {ids: new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2),
      sizes: meta.sizes, labels: meta.labels, page: meta.page,
      min: meta.min_face_px, mm2: meta.mm2_per_px};
    FACES.set(n, out);
    return out;
  },

  async probe(plate, at) {
    const F = await this.faces(plate);
    const [W, H] = F.page;
    const x = Math.round(at[0]), y = Math.round(at[1]);
    const fid = (x >= 0 && x < W && y >= 0 && y < H) ? F.ids[y * W + x] : 0;
    const names = fid ? [...new Set(F.labels.filter((l) => l[2] === fid).map((l) => l[0]))].sort() : [];
    const mm = toMm(at[0], at[1]);
    let best = Infinity;
    for (const p of S.paths) {
      if (!p.pts) p.pts = flattenD(p.d);
      for (const q of p.pts) {
        const dd = (q[0] - at[0]) * (q[0] - at[0]) + (q[1] - at[1]) * (q[1] - at[1]);
        if (dd < best) best = dd;
      }
    }
    for (const o of S.d.outline) {
      for (const q of o) {
        const dd = (q[0] - at[0]) * (q[0] - at[0]) + (q[1] - at[1]) * (q[1] - at[1]);
        if (dd < best) best = dd;
      }
    }
    const reg = regionAt(at[0], at[1]);
    return {page_px: [round2(at[0]), round2(at[1])], mm: [round3(mm[0]), round3(mm[1])],
      face: fid, face_px: fid ? F.sizes[fid] : 0,
      face_mm2: fid ? Math.round(F.sizes[fid] * F.mm2 * 1e4) / 1e4 : 0,
      names, owner: reg ? reg.abbr : null,
      ink_px: Math.round(Math.sqrt(best) * 10) / 10, min_face_px: F.min};
  },

  document: async (draft) => { const doc = buildDoc(draft); return {doc, text: renderDoc(doc)}; },

  inspect: null,
  recut: null,

  async save(draft, name) {
    const doc = buildDoc(draft);
    const file = (name || doc.id).replace(/^.*[\\/]/, '').replace(/\.json$/, '') + '.json';
    download(file, renderDoc(doc));
    return {path: file};
  },

  open() {
    return new Promise((res, rej) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'application/json,.json';
      inp.onchange = async () => {
        const f = inp.files && inp.files[0];
        if (!f) return rej(new Error('nothing chosen'));
        try { res({draft: draftOf(JSON.parse(await f.text())), path: f.name}); }
        catch (e) { rej(new Error(f.name + ': ' + e.message)); }
      };
      inp.click();
    });
  },

  // items: [{draft, png}], every file of one send; one picture a plate, carried by the
  // first file written for it
  async commit(items, dry) {
    const now = new Date(), stamp = stampOf(now);
    const docs = [], pngs = new Map();
    for (const it of items) {
      const doc = buildDoc(it.draft, now);
      if (!doc.abbr) throw new Error('name the region first');
      if (!doc.seeds.length && !doc.boundaries.length && !doc.extents.length) {
        throw new Error('mark something first: a seed, a boundary or an extent');
      }
      if (it.png && !pngs.has(doc.plate)) pngs.set(doc.plate, {id: doc.id, png: it.png});
      if (pngs.has(doc.plate)) doc.snapshot = 'corrections/' + pngs.get(doc.plate).id + '.png';
      docs.push(doc);
    }
    if (new Set(docs.map((d) => d.id)).size !== docs.length) {
      throw new Error('two corrections for the same region on the same plate: mark them as one');
    }
    const texts = docs.map(renderDoc);
    const json = texts.join('\n');
    if (dry) {
      docs.forEach((d, i) => download(d.id + '.json', texts[i]));
      return {id: docs[0].id, ids: docs.map((d) => d.id), dry: true,
        path: docs[0].id + '.json', paths: docs.map((d) => d.id + '.json'), json};
    }

    const tok = await token();
    const api_ = async (path, opts) => {
      const r = await fetch('https://api.github.com/repos/' + REPO.owner + '/' + REPO.repo + path,
        Object.assign({headers: {Authorization: 'Bearer ' + tok,
          Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}}, opts));
      const j = r.status === 204 ? {} : await r.json();
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) forgetToken();
        throw new Error('GitHub said ' + r.status + ': ' + (j.message || '')
          + (r.status === 401 ? ' — the token is wrong or expired, so it has been forgotten'
            : r.status === 403 ? ' — the token needs Contents: read and write on '
              + REPO.owner + '/' + REPO.repo : ''));
      }
      return j;
    };
    // One commit through the Git Data API -- blob, tree, commit, then the branch pointed
    // at it. Two `contents` PUTs were two commits and two pushes, and every push of a
    // correction file dispatches apply-correction.yml, so the workflow ran twice.
    const branch = branchFor(docs, stamp);
    const head = await api_('/git/ref/heads/' + REPO.base);
    const parent = await api_('/git/commits/' + head.object.sha);
    const blob = async (content) => (await api_('/git/blobs', {method: 'POST',
      body: JSON.stringify({content, encoding: 'base64'})})).sha;
    const tree = [];
    for (let i = 0; i < docs.length; i++) {
      tree.push({path: 'corrections/' + docs[i].id + '.json', mode: '100644', type: 'blob',
        sha: await blob(b64(texts[i]))});
    }
    for (const {id, png} of pngs.values()) {
      tree.push({path: 'corrections/' + id + '.png', mode: '100644', type: 'blob',
        sha: await blob(png.replace(/^data:[^,]*,/, ''))});
    }
    const made = await api_('/git/trees', {method: 'POST',
      body: JSON.stringify({base_tree: parent.tree.sha, tree})});
    const commit = await api_('/git/commits', {method: 'POST', body: JSON.stringify({
      message: messageFor(docs), tree: made.sha, parents: [head.object.sha]})});
    await api_('/git/refs', {method: 'POST',
      body: JSON.stringify({ref: 'refs/heads/' + branch, sha: commit.sha})});
    const url = 'https://github.com/' + REPO.owner + '/' + REPO.repo;
    return {id: docs[0].id, ids: docs.map((d) => d.id), dry: false, branch, json,
      url: url + '/tree/' + branch, actions: url + '/actions/workflows/apply-correction.yml'};
  },
};

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function b64(text) {
  const bytes = new TextEncoder().encode(text);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

const TOKKEY = 'atlasfix.token';
const forgetToken = () => { try { localStorage.removeItem(TOKKEY); } catch (e) { /* private mode */ } };
function haveToken() { try { return localStorage.getItem(TOKKEY) || ''; } catch (e) { return ''; } }

function token() {
  const have = haveToken();
  if (have) return Promise.resolve(have);
  return new Promise((res, rej) => {
    sheet('A token to push with',
      '<p>The published page has no git behind it, so it writes the branch through the '
      + 'GitHub API. That needs a <b>fine-grained personal access token</b> for '
      + '<code>' + REPO.owner + '/' + REPO.repo + '</code> with <b>Contents: read and '
      + 'write</b>, and nothing else.</p>'
      + '<p><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" '
      + 'rel="noreferrer">Make one</a>, then paste it here. It is kept in this browser\u2019s '
      + 'local storage for this site and sent to nowhere but api.github.com. Anyone with '
      + 'the browser has it, so give it the shortest life you can stand, and '
      + '<b>Forget the token</b> in the panel clears it.</p>'
      + '<input id="m-tok" type="password" autocomplete="off" placeholder="github_pat_…">',
      [['Cancel', () => { closeSheet(); rej(new Error('no token: nothing was sent')); }],
        ['Keep it and push', () => {
          const t = $('m-tok').value.trim();
          closeSheet();
          if (!t) { rej(new Error('no token: nothing was sent')); return; }
          try { localStorage.setItem(TOKKEY, t); } catch (e) { /* private mode: this run only */ }
          res(t);
        }, 'go']]);
  });
}

/* ------------------------------------------------- the document, on the page
 *
 * The published page has no Python, so it writes the correction itself. This is the
 * same document tools/atlasfix.py builds -- same keys in the same order, same rounding,
 * same rendering, so a file written here and one written there differ only in `id`,
 * `created` and `source`. A test drives both against one draft and diffs them, because
 * two writers of one schema is exactly the thing that drifts. */

const trim = (v, n) => {
  const r = Math.round(v * Math.pow(10, n)) / Math.pow(10, n);
  return Object.is(r, -0) ? 0 : r;
};

const p2 = (v) => String(v).padStart(2, '0');
// the moment a correction was made, as its id carries it: 20260905T160102Z
const stampOf = (now) => now.getUTCFullYear() + p2(now.getUTCMonth() + 1) + p2(now.getUTCDate())
  + 'T' + p2(now.getUTCHours()) + p2(now.getUTCMinutes()) + p2(now.getUTCSeconds()) + 'Z';

function buildDoc(draft, when) {
  const n = Number(draft.plate);
  const ab = (draft.abbr || '').trim();
  const now = when || new Date();           // a batch shares one, so its ids share a prefix
  const stamp = stampOf(now);
  const created = now.getUTCFullYear() + '-' + p2(now.getUTCMonth() + 1) + '-' + p2(now.getUTCDate())
    + 'T' + p2(now.getUTCHours()) + ':' + p2(now.getUTCMinutes()) + ':' + p2(now.getUTCSeconds()) + 'Z';
  const on = framesOf(n);                   // the draft's plate, which need not be on screen
  const pt = (q) => {
    const mm = toMm(q[0], q[1], on);
    return [[trim(q[0], 2), trim(q[1], 2)], [trim(mm[0], 3), trim(mm[1], 3)]];
  };
  const doc = {
    schema: 'gerbil-atlas-correction/1',
    id: stamp + '-p' + p2(n) + '-' + (ab || 'region').replace(/[^A-Za-z0-9_-]/g, '_'),
    created,
    author: draft.author || S.boot.author || '',
    plate: n,
    ap_bregma_mm: (S.boot.plates.find((q) => q.plate === n) || {}).bregma,
    abbr: ab,
    hemisphere: '',
    problem: (draft.problem || '').trim(),
    seeds: [], boundaries: [], extents: [],
    notes: (draft.notes || []).map(String),
    preview: draft.preview || null,
    snapshot: draft.snapshot || null,
    source: SRC.pipeline ? null : {
      commit: S.boot.commit || '', site: location.origin + BASE,
      repo: REPO.owner + '/' + REPO.repo, tool: 'atlasfix (the published page) 1.0',
      browser: navigator.userAgent,
    },
  };
  for (const s of draft.seeds || []) {
    const [pg, mm] = pt(s.page_px);
    const e = {abbr: s.abbr || ab, kind: (s.kind || 'positive').toLowerCase(),
      page_px: pg, mm, note: (s.note || '').trim()};
    if (s.label_index !== undefined && s.label_index !== null) e.label_index = Number(s.label_index);
    doc.seeds.push(e);
  }
  for (const b of draft.boundaries || []) {
    const q = (b.page_px || []).map(pt);
    doc.boundaries.push({style: (b.style || 'solid').toLowerCase(), closed: !!b.closed,
      page_px: q.map((z) => z[0]), mm: q.map((z) => z[1]), note: (b.note || '').trim()});
  }
  for (const e of draft.extents || []) {
    let pts = (e.page_px || []).slice();
    if (pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0],
      pts[0][1] - pts[pts.length - 1][1]) < 1e-9) pts.pop();
    const q = pts.map(pt);
    doc.extents.push({abbr: e.abbr || ab, kind: (e.kind || 'positive').toLowerCase(),
      page_px: q.map((z) => z[0]), mm: q.map((z) => z[1]), note: (e.note || '').trim()});
  }
  doc.hemisphere = draft.hemisphere || hemisphereOf(doc);
  return doc;
}

function hemisphereOf(doc) {
  const ml = [];
  for (const s of doc.seeds) ml.push(s.mm[0]);
  for (const key of ['boundaries', 'extents']) {
    for (const e of doc[key]) ml.push(e.mm.reduce((a, q) => a + q[0], 0) / e.mm.length);
  }
  if (!ml.length) return '';
  return ml.every((v) => v < 0) ? 'left' : ml.every((v) => v > 0) ? 'right' : 'both';
}

function renderDoc(doc) {
  const enc = (o, level) => JSON.stringify(o, null, 1).replace(/\n/g, '\n' + ' '.repeat(level));
  const entry = (e, level) => '{\n' + Object.keys(e).map((k) =>       // every value compact:
    ' '.repeat(level + 1) + JSON.stringify(k) + ': ' + JSON.stringify(e[k])   // a point list is one line
  ).join(',\n') + '\n' + ' '.repeat(level) + '}';
  const keys = Object.keys(doc);
  const out = ['{'];
  keys.forEach((k, i) => {
    const comma = i < keys.length - 1 ? ',' : '';
    const v = doc[k];
    if ((k === 'seeds' || k === 'boundaries' || k === 'extents') && v.length) {
      out.push(' ' + JSON.stringify(k) + ': [\n'
        + v.map((e) => '  ' + entry(e, 2)).join(',\n') + '\n ]' + comma);
    } else {
      out.push(' ' + JSON.stringify(k) + ': ' + enc(v, 1) + comma);
    }
  });
  out.push('}');
  return out.join('\n') + '\n';
}

function draftOf(doc) {
  const keep = ['plate', 'abbr', 'problem', 'hemisphere', 'seeds', 'boundaries', 'extents',
    'notes', 'author'];
  const out = {};
  for (const k of keep) if (doc[k] !== undefined && doc[k] !== null) out[k] = doc[k];
  return out;
}

/* Everything waiting to be sent: every plate that holds marks, and on each plate one
   correction for each region marked on it. A seed and an extent carry the region they
   were made for, a boundary the region that was chosen when it was drawn, or none, in
   which case it goes with the region the plate was left on. The regions go in the order
   their first mark was made, seeds before extents before boundaries. The plate's own text
   goes with each of its files; its notes, and the recut preview where the plate is one
   region's, with the first. */
function batch() {
  stashDraft();
  const out = [];
  for (const n of markedPlates()) {
    const D = S.drafts.get(n);
    if (!D) continue;
    const groups = new Map();
    const group = (ab) => {
      const k = ab || D.abbr || '';
      if (!groups.has(k)) {
        groups.set(k, Object.assign(blankDraft(n), {abbr: k, problem: D.problem, author: D.author}));
      }
      return groups.get(k);
    };
    for (const s of D.seeds) group(s.abbr).seeds.push(s);
    for (const e of D.extents) group(e.abbr).extents.push(e);
    for (const b of D.boundaries) group(b.abbr).boundaries.push(b);
    const gs = [...groups.values()].filter(marksIn);
    gs.forEach((g, i) => {
      if (i === 0) { g.notes = D.notes.slice(); if (gs.length === 1) g.preview = D.preview; }
      out.push({plate: n, draft: g});
    });
  }
  return out;
}

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const counted = (n, one) => n + ' ' + one + (n === 1 ? '' : 's');
function marksSaid(D) {
  return [[D.seeds.length, 'seed'], [D.boundaries.length, 'boundary'], [D.extents.length, 'extent']]
    .filter(([n]) => n).map(([n, w]) => counted(n, w)).join(', ');
}

/* The branch a send goes on, and the message on its commit: one correction is named
   for its id, as it always was; several are named for the moment they were sent
   together, and the message lists them. What is wrong is a plate's own words and
   optional, so a plate left without them writes no line rather than an empty one, and
   a send with none written writes no body. tools/atlasfix.py says the same. */
const branchFor = (docs, stamp) => 'correction/' + (docs.length === 1 ? docs[0].id : stamp);
function messageFor(docs) {
  if (docs.length === 1) {
    const d = docs[0];
    return 'Correction: ' + d.abbr + ' on plate ' + d.plate
      + (d.problem ? '\n\n' + d.problem : '') + '\n\nCorrection-Id: ' + d.id;
  }
  const said = [];
  for (const d of docs) {
    if (!d.problem) continue;
    const line = 'plate ' + d.plate + ': ' + d.problem;
    if (!said.includes(line)) said.push(line);
  }
  return 'Corrections: ' + docs.map((d) => d.abbr + ' on plate ' + d.plate).join(', ')
    + (said.length ? '\n\n' + said.join('\n') : '')
    + '\n\n' + docs.map((d) => 'Correction-Id: ' + d.id).join('\n');
}

/* ------------------------------------------------------------------- plate */

/* The plate a draft belongs to. A correction is one plate's, so leaving a plate puts
   its draft away under its number and arriving at one takes back whatever was left
   there; what carries across is the region being worked on, which is a choice about
   what to look at rather than a mark on a page. A draft with nothing in it is not
   kept, so walking the plates leaves nothing behind. */
const marksIn = (D) => D.seeds.length + D.boundaries.length + D.extents.length;

function stashDraft() {
  const D = S.draft;
  if (!D || !D.plate) return;
  D.problem = $('problem').value;
  if (marksIn(D) || D.notes.length || D.problem.trim()) S.drafts.set(D.plate, D);
  else S.drafts.delete(D.plate);
}

/* The plates with marks waiting on them, this one included while it has any. */
function markedPlates() {
  const out = new Set();
  for (const [n, D] of S.drafts) if (marksIn(D)) out.add(n);
  if (marksIn(S.draft)) out.add(S.draft.plate); else out.delete(S.draft.plate);
  out.delete(0);
  return [...out].sort((a, b) => a - b);
}

/* A plate is a fetch, and the slider can ask for the next one before this one lands,
   so each load is stamped and a superseded one drops what it fetched rather than
   drawing it over the plate that overtook it. */
let ASK = 0, IMG = 0;

async function loadPlate(n) {
  const mine = ++ASK;
  S.want = n;
  stashDraft();
  const d = await SRC.plate(n);
  if (mine !== ASK) return;                 // the plate was changed again while this loaded
  S.plate = n; S.d = d; S.cut = null; S.pending = null;
  S.ink = null; S.hover = null; S.snapAt = null; S.lead = null; S.hi = null;
  S.rot = quarterTurn(d.m, d.page[0], d.page[1]);
  S.show.cut = false; $('v-cut').checked = false; $('v-cut').disabled = true;
  S.draft = S.drafts.get(n) || blankDraft(n);
  if (!S.draft.abbr) S.draft.abbr = S.abbr;
  S.abbr = S.draft.abbr;
  $('problem').value = S.draft.problem || '';
  S.paths = d.paths.map((p) => ({p: new Path2D(p.d), d: p.d, style: p.style, corr: p.corr}));
  syncPlate(n);
  $('where').textContent = 'plate ' + n + ', bregma ' + fmt(d.bregma) + ' mm · page '
    + d.page[0] + ' × ' + d.page[1] + ' px';
  if (!d.layers.includes(S.layer)) S.layer = d.layers[0];
  layerSeg();
  await loadImage();
  if (mine !== ASK) return;
  fit();
  renderRegions(); renderMarks(); selectFacts(); renderOpts();
}

function loadImage() {
  const mine = ++IMG;
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      if (mine !== IMG) return res();       // another plate or another layer was asked for
      S.img = im;
      const f = S.d.frame, sx = f.w / im.naturalWidth, sy = f.h / im.naturalHeight, m = S.d.im;
      S.imgM = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]];
      draw(); res();
    };
    im.onerror = () => { if (mine === IMG) { S.img = null; draw(); } res(); };
    im.src = SRC.image(S.layer, S.plate);
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

/* ------------------------------------------------------------------- the ink
 *
 * The traced ink of the plate on screen -- every path of its tracing, cut into the points
 * flattenD makes of it, and the section outline -- in a grid, so the pointer can ask for
 * the nearest point of ink as it moves. Those are the points the pipeline's own bridging
 * measures to: build_region_extents puts every vertex of every flattened polyline in one
 * k-d tree and bridges an open end to the nearest one within BRIDGE_PX. So a point snapped
 * onto one is on the ink by the pipeline's measure, and the gap said at a boundary's end is
 * the gap the bridge would see. The draft's own boundaries are ink too once they are
 * applied, and are measured along their length, which is how they will be written. */

const INK_CELL = 32;                    // page px

function inkIndex() {
  if (S.ink) return S.ink;
  const grid = new Map();
  const put = (q) => {
    const k = Math.floor(q[0] / INK_CELL) + ',' + Math.floor(q[1] / INK_CELL);
    const c = grid.get(k);
    if (c) c.push(q); else grid.set(k, [q]);
  };
  for (const p of S.paths) {
    if (!p.pts) p.pts = flattenD(p.d);
    for (const q of p.pts) put(q);
  }
  for (const o of S.d.outline) for (const q of o) put(q);
  S.ink = {grid};
  return S.ink;
}

function closestOnSeg(a, b, at) {
  const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy;
  const t = L2 ? Math.max(0, Math.min(1, ((at[0] - a[0]) * vx + (at[1] - a[1]) * vy) / L2)) : 0;
  return [a[0] + t * vx, a[1] + t * vy];
}

/* The nearest ink to `at` within r page px -- the tracing, the outline, and the draft's
   boundaries but the one numbered `skip` -- as {pt, d}, or null. */
function nearInk(at, r, skip) {
  const I = inkIndex();
  let best = null, bd = r * r;
  const x0 = Math.floor((at[0] - r) / INK_CELL), x1 = Math.floor((at[0] + r) / INK_CELL);
  const y0 = Math.floor((at[1] - r) / INK_CELL), y1 = Math.floor((at[1] + r) / INK_CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const c = I.grid.get(cx + ',' + cy);
      if (!c) continue;
      for (const q of c) {
        const dd = (q[0] - at[0]) * (q[0] - at[0]) + (q[1] - at[1]) * (q[1] - at[1]);
        if (dd <= bd) { bd = dd; best = q; }
      }
    }
  }
  S.draft.boundaries.forEach((b, i) => {
    if (i === skip) return;
    const pts = b.closed ? b.page_px.concat([b.page_px[0]]) : b.page_px;
    for (let j = 0; j + 1 < pts.length; j++) {
      const q = closestOnSeg(pts[j], pts[j + 1], at);
      const dd = (q[0] - at[0]) * (q[0] - at[0]) + (q[1] - at[1]) * (q[1] - at[1]);
      if (dd <= bd) { bd = dd; best = q; }
    }
  });
  return best ? {pt: best, d: Math.sqrt(bd)} : null;
}

const SNAP_PX = 10;                     // screen px: how near the ink a point snaps onto it
// the boundary being redrawn is not ink to itself
const skipOf = (p) => (p && p.src && p.src.key === 'boundaries' ? p.src.i : -1);
function snapPt(at, p) {
  if (!S.opts.snap) return at;
  const n = nearInk(at, W(SNAP_PX), skipOf(p));
  return n ? n.pt.slice() : at;
}
// how far a boundary's end is from the ink it has to reach: Infinity past 400 px
function gapAt(q, skip) {
  const n = nearInk(q, 400, skip);
  return n || {pt: null, d: Infinity};
}

/* ------------------------------------------------------------------ drawing */

function resize() {
  const r = cv.getBoundingClientRect();
  cv.width = Math.round(r.width * DPR); cv.height = Math.round(r.height * DPR);
  // a view left as it was fitted stays fitted -- the panel opening or shutting, or a
  // phone turned on its side, changes the room and should not leave the plate adrift
  if (S.fitted) fit(); else draw();
}
function fit() {
  if (!S.d) return;
  // the section, not the page it is printed on. The page frame carries the atlas's
  // rulers, its plate number and its coordinate table, and fitting those leaves the
  // brain in the middle third -- which on a phone held upright is most of the screen
  // spent on white paper.
  let pts = [];
  for (const o of S.d.outline) pts = pts.concat(o);
  if (pts.length < 3) {
    const f = S.d.frame, m = S.d.im;
    pts = [xf(m, 0, 0), xf(m, f.w, 0), xf(m, f.w, f.h), xf(m, 0, f.h)];
  }
  let w = 0, h = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  w = x1 - x0; h = y1 - y0;
  zoomTo(pts, 0.05 * Math.max(w, h));
  S.fitted = true;
}
function zoomTo(ring, pad) {
  S.fitted = false;
  const r = cv.getBoundingClientRect();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  // the box to frame is the one on screen, so the points are turned before it is measured
  for (const p of ring) {
    const [x, y] = xf(S.rot, p[0], p[1]);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const p = pad === undefined ? 60 : pad;
  x0 -= p; y0 -= p; x1 += p; y1 += p;
  const k = Math.min(r.width / (x1 - x0), r.height / (y1 - y0));
  S.view = {k, x: -x0 * k + (r.width - (x1 - x0) * k) / 2, y: -y0 * k + (r.height - (y1 - y0) * k) / 2};
  draw();
}
function setT(a, b, c, d, e, f) { ctx.setTransform(a * DPR, b * DPR, c * DPR, d * DPR, e * DPR, f * DPR); }
function page() { setT.apply(null, viewM()); }
function screen() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
function W(px) { return px / S.view.k; }

function poly(pts, close) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
// the palette, read once a frame rather than once a path: a theme change is the next frame's
let CSSV = new Map();
function css(name) {
  if (!CSSV.has(name)) CSSV.set(name, getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  return CSSV.get(name);
}
// a frame asked for from the pointer, drawn once however many moves arrive before it
let FRAME = 0;
function redraw() {
  if (FRAME) return;
  FRAME = requestAnimationFrame(() => { FRAME = 0; draw(); });
}

function draw() {
  if (!S.d) return;
  CSSV = new Map();
  const r = cv.getBoundingClientRect();
  screen();
  ctx.clearRect(0, 0, r.width, r.height);
  ctx.fillStyle = css('--bg'); ctx.fillRect(0, 0, r.width, r.height);

  if (S.img && S.imgM) {
    setT.apply(null, mul6(viewM(), S.imgM));
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

  // the printed labels: the box, and where it seeds -- always, under the leader tool
  if (S.show.lab || S.tool === 'leader') drawLabels();

  drawMarks();
  if (S.pending) drawPending();
  drawSnap();
  screen();
  if (S.show.lab || S.tool === 'leader') labelText();
  markTags();
  $('zoom').textContent = (S.view.k * 100).toFixed(0) + '%  ·  '
    + (1 / (S.view.k) * S.d.mm_per_px * 1000).toFixed(0) + ' µm/px';
}

/* Every printed label: its box, and where it seeds. A label on a line seeds at the line's
   end, drawn as a dot -- blue where an earlier correction moved it -- and a label printed
   in place seeds at the word, which the leader tool marks with a ring to take hold of.
   Where the draft moves one, the end it had is left as a dashed ghost, and drawMarks
   draws the new one. */
function drawLabels() {
  const leading = S.tool === 'leader';
  const hov = S.hover && S.hover.kind === 'label' ? S.hover.L : null;
  for (const L of S.d.labels) {
    const on = L.abbr === S.abbr, chosen = S.lead === L;
    const big = leading && (L === hov || chosen);
    ctx.globalAlpha = leading && isFeature(L.abbr) ? 0.4 : 1;
    poly(L.box, true);
    ctx.strokeStyle = chosen || on ? css('--accent') : css('--box');
    ctx.lineWidth = W(chosen ? 2.4 : on ? 1.6 : 0.9); ctx.stroke();
    const moved = leaderSeed(L) >= 0;
    const c = boxMid(L);
    if (L.led) {
      ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(L.at[0], L.at[1]);
      ctx.strokeStyle = css('--box'); ctx.lineWidth = W(big ? 1.6 : 0.9);
      if (moved) ctx.setLineDash([W(3), W(3)]);
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (moved) {                                  // where it ended before the draft moved it
      ctx.beginPath(); ctx.arc(L.at[0], L.at[1], W(4.5), 0, 7);
      ctx.setLineDash([W(2), W(2)]);
      ctx.strokeStyle = css('--box'); ctx.lineWidth = W(1.3); ctx.stroke();
      ctx.setLineDash([]);
    } else if (L.led) {
      ctx.beginPath(); ctx.arc(L.at[0], L.at[1], W(big ? 6.5 : leading ? 4.5 : 3.5), 0, 7);
      ctx.fillStyle = L.byhand ? css('--seed') : css('--box'); ctx.fill();
      if (leading) { ctx.strokeStyle = '#fff'; ctx.lineWidth = W(1.3); ctx.stroke(); }
    } else if (leading) {
      ctx.beginPath(); ctx.arc(c[0], c[1], W(big ? 6.5 : 4.5), 0, 7);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = css('--box'); ctx.lineWidth = W(big ? 2.4 : 1.8); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// text with a pale halo, so it reads on the plate under it
function tagAt(text, x, y, color) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 3.5; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

function labelText() {
  const V = viewM();
  ctx.font = '600 11px ui-sans-serif,system-ui,sans-serif';
  const hov = S.tool === 'leader' && S.hover && S.hover.kind === 'label' ? S.hover.L : null;
  for (const L of S.d.labels) {
    if (L.abbr !== S.abbr && L !== hov && L !== S.lead) continue;
    // the box's top-left on screen, which on a turned page is not its first corner
    let x = Infinity, y = Infinity;
    for (const q of L.box) {
      const at = xf(V, q[0], q[1]);
      x = Math.min(x, at[0]); y = Math.min(y, at[1]);
    }
    let t = L.abbr + '[' + L.index + ']';
    if (L === hov && isFeature(L.abbr)) t += ' · a feature, not a region';
    tagAt(t, x, y - 3, css('--accent'));
  }
}

/* What each mark says, beside it: a dot alone does not say which region it is for. */
function markTags() {
  const V = viewM(), D = S.draft, p = S.pending;
  ctx.font = '600 10.5px ui-sans-serif,system-ui,sans-serif';
  for (const s of D.seeds) {
    const at = xf(V, s.page_px[0], s.page_px[1]);
    const t = isLead(s) ? s.abbr + '[' + s.label_index + ']' : (s.kind === 'negative' ? 'not ' : '') + s.abbr;
    tagAt(t, at[0] + 9, at[1] - 7, s.kind === 'negative' ? css('--unseed') : css('--seed'));
  }
  D.extents.forEach((e, i) => {
    if (p && p.src && p.src.key === 'extents' && p.src.i === i) return;
    let top = null;
    for (const q of e.page_px) {
      const at = xf(V, q[0], q[1]);
      if (!top || at[1] < top[1]) top = at;
    }
    if (top) tagAt((e.kind === 'negative' ? 'not ' : '') + e.abbr, top[0] + 4, top[1] - 6, css('--ext'));
  });
}

function drawMarks() {
  const D = S.draft, p = S.pending;
  const editing = (key, i) => p && p.src && p.src.key === key && p.src.i === i;
  const lit = (key, i) => S.hi && S.hi.key === key && S.hi.i === i;
  const glow = () => {                     // the mark whose row the pointer is over
    ctx.save(); ctx.strokeStyle = 'rgba(255,190,0,.55)'; ctx.lineWidth = W(10);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
  };
  D.extents.forEach((e, i) => {
    if (editing('extents', i)) return;
    const neg = e.kind === 'negative';
    poly(e.page_px, true);
    if (lit('extents', i)) glow();
    if (!neg) { ctx.fillStyle = 'rgba(196,0,196,.12)'; ctx.fill(); }
    ctx.strokeStyle = css('--ext'); ctx.lineWidth = W(2); ctx.stroke();
    if (neg) crossOut(e.page_px);
  });
  D.boundaries.forEach((b, i) => {
    if (editing('boundaries', i)) return;
    poly(b.page_px, !!b.closed);
    if (lit('boundaries', i)) glow();
    ctx.strokeStyle = css('--bound'); ctx.lineWidth = W(2.5);
    ctx.setLineDash(b.style === 'dashed' ? [W(8), W(5)] : []);
    ctx.stroke(); ctx.setLineDash([]);
    if (!b.closed) endMarks(b.page_px, i, false);
  });
  // the point of a finished shape a press would open it at
  if (!p && S.hover && S.hover.kind === 'mark') {
    const q = D[S.hover.key][S.hover.m].page_px[S.hover.i];
    ctx.beginPath(); ctx.arc(q[0], q[1], W(6.5), 0, 7);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = S.hover.key === 'extents' ? css('--ext') : css('--bound');
    ctx.lineWidth = W(2); ctx.stroke();
  }
  D.seeds.forEach((s, i) => {
    const [x, y] = s.page_px, neg = s.kind === 'negative';
    const L = isLead(s) ? labelOf(s.abbr, s.label_index) : null;
    if (lit('seeds', i)) {
      ctx.beginPath(); ctx.arc(x, y, W(12), 0, 7);
      ctx.fillStyle = 'rgba(255,190,0,.5)'; ctx.fill();
    }
    if (L) {                               // a label's line, moved: from its box to here
      const c = boxMid(L);
      ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(x, y);
      ctx.strokeStyle = css('--seed'); ctx.lineWidth = W(1.8); ctx.stroke();
    }
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
  });
}

/* A boundary's two ends, each ringed in the colour of what the pipeline will do with it:
   on the ink or near enough to be bridged, or too far -- with a dashed line to the ink it
   would have to reach, and while it is being drawn, how far that is. */
function endMarks(pts, skip, say) {
  const bridge = S.d.bridge_px;
  for (const q of [pts[0], pts[pts.length - 1]]) {
    const g = gapAt(q, skip);
    const ok = g.d <= bridge;
    if (!ok && g.pt) {
      ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(g.pt[0], g.pt[1]);
      ctx.setLineDash([W(3), W(3)]); ctx.strokeStyle = css('--unseed'); ctx.lineWidth = W(1.3);
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.beginPath(); ctx.arc(q[0], q[1], W(5), 0, 7);
    ctx.strokeStyle = ok ? css('--bound') : css('--unseed'); ctx.lineWidth = W(ok ? 1.5 : 2.2);
    ctx.stroke();
    if (say && g.d > 0.5) {
      const at = xf(viewM(), q[0], q[1]);
      screen();
      ctx.font = '600 10.5px ui-sans-serif,system-ui,sans-serif';
      tagAt(isFinite(g.d) ? g.d.toFixed(0) + ' px to the ink' + (ok ? ', bridged' : ': not bridged') : 'far from the ink',
        at[0] + 8, at[1] + 14, ok ? css('--bound') : css('--unseed'));
      page();
    }
  }
}

function drawPending() {
  const p = S.pending, pts = p.pts;
  if (!pts.length) return;
  const ext = p.kind === 'extent', neg = ext && p.ekind === 'negative';
  const col = ext ? css('--ext') : css('--bound');
  const closed = ext || !!p.closed;
  const drawing = !p.edit;
  const nxt = drawing && S.at && !PTR.size ? (S.snapAt || S.at) : null;
  let shape = nxt ? pts.concat([nxt]) : pts;
  let gone = null;
  if (p.redraw) {
    const r = redrawn(p, false);
    if (r) { shape = r.pts; gone = r.gone; }
  }
  if (gone) {                                    // the stretch the new line replaces
    poly(gone, false);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = W(6); ctx.stroke();
    ctx.strokeStyle = css('--unseed'); ctx.lineWidth = W(3); ctx.setLineDash([W(6), W(4)]);
    ctx.stroke(); ctx.setLineDash([]);
  }
  poly(shape, closed && shape.length > 2);
  if (ext && shape.length > 2 && !neg) { ctx.fillStyle = 'rgba(196,0,196,.10)'; ctx.fill(); }
  ctx.strokeStyle = col; ctx.lineWidth = W(2.5);
  ctx.setLineDash(p.kind === 'boundary' && p.style === 'dashed' ? [W(8), W(5)] : []);
  ctx.stroke(); ctx.setLineDash([]);
  if (neg && shape.length > 2) crossOut(shape);

  if (p.redraw) {                                // the new line, and where it leaves the shape
    const rp = p.redraw.pts;
    if (rp.length) {
      const live = S.at && !PTR.size ? rp.concat([S.snapAt || S.at]) : rp;
      poly(live, false);
      ctx.strokeStyle = css('--accent'); ctx.lineWidth = W(1.5); ctx.stroke();
      for (const q of rp) {
        ctx.beginPath(); ctx.arc(q[0], q[1], W(4), 0, 7);
        ctx.fillStyle = css('--accent'); ctx.fill();
      }
    }
    return;
  }

  // the points: hollow where the pointer is over one, ringed where one is chosen
  const hv = S.hover && S.hover.kind === 'vertex' ? S.hover.i : -1;
  const r0 = pts.length > 60 ? 3 : 4;
  for (let i = 0; i < pts.length; i++) {
    const on = i === hv || i === G_VERTEX(), sel = i === p.sel;
    const first = drawing && ext && i === 0 && pts.length >= 3;
    ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], W(on || first ? 6.5 : sel ? 5.5 : r0), 0, 7);
    ctx.fillStyle = on || first ? '#fff' : col;
    ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = W(1.5); ctx.stroke();
    if (sel) {
      ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], W(9), 0, 7);
      ctx.strokeStyle = css('--accent'); ctx.lineWidth = W(2); ctx.stroke();
    }
  }
  // where a press on an edge would put a new point
  if (p.edit && S.hover && S.hover.kind === 'edge') {
    const q = S.hover.pt;
    ctx.beginPath(); ctx.arc(q[0], q[1], W(6), 0, 7);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = W(1.5); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(q[0] - W(3.5), q[1]); ctx.lineTo(q[0] + W(3.5), q[1]);
    ctx.moveTo(q[0], q[1] - W(3.5)); ctx.lineTo(q[0], q[1] + W(3.5));
    ctx.stroke();
  }
  if (p.kind === 'boundary' && !closed && pts.length >= (drawing ? 1 : 2)) {
    endMarks(drawing && nxt ? [pts[0], nxt] : [pts[0], pts[pts.length - 1]], skipOf(p), true);
  }
}
// the point being dragged, which is drawn as the pointer's
const G_VERTEX = () => (G && G.kind === 'vertex' ? G.i : -1);

// where the next point would snap to: a ring on the ink
function drawSnap() {
  if (!S.snapAt) return;
  const q = S.snapAt;
  ctx.beginPath(); ctx.arc(q[0], q[1], W(8), 0, 7);
  ctx.strokeStyle = css('--bound'); ctx.lineWidth = W(1.6); ctx.stroke();
  ctx.beginPath(); ctx.arc(q[0], q[1], W(2), 0, 7);
  ctx.fillStyle = css('--bound'); ctx.fill();
}

/* An extent that says the region is not there, crossed over the box of what it
   encloses -- the mark tools/corrections.py draws in qc/chk_corr_<id>.png, so a
   negative extent reads the same on the plate and in the picture the session writes. */
function crossOut(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.moveTo(x0, y1); ctx.lineTo(x1, y0);
  ctx.strokeStyle = css('--unseed'); ctx.lineWidth = W(2.5); ctx.stroke();
}

/* ------------------------------------------------------------------ leaders */

// A feature of the drawing -- a fissure, a vessel -- is printed and seeded like a region,
// but a correction names regions only, so its line is not one to move from here.
function isFeature(ab) {
  const f = S.boot.features;
  return Array.isArray(f) ? f.includes(ab) : !!(f && f[ab]);
}
const labelOf = (ab, i) => S.d.labels.find((L) => L.abbr === ab && L.index === i);
const boxMid = (L) => [(L.box[0][0] + L.box[2][0]) / 2, (L.box[0][1] + L.box[2][1]) / 2];
// a seed standing in for a printed label: positive, with the label's index -- what
// tools/corrections.py apply writes over that label's seed
const isLead = (s) => s.label_index !== undefined && s.label_index !== null
  && (s.kind || 'positive') === 'positive';
// the draft's seed standing in for label L, or -1
const leaderSeed = (L) => S.draft.seeds.findIndex((s) => isLead(s) && s.abbr === L.abbr
  && s.label_index === L.index);
// where label L seeds: where the draft has moved it, else where the plate has it
const endOf = (L) => { const k = leaderSeed(L); return k >= 0 ? S.draft.seeds[k].page_px : L.at; };

/* The label a press takes hold of, and by what: the one whose end is nearest, within
   reach -- which a drag moves -- else the box it is inside, which a click chooses and a
   drag pans across. While a label is chosen only ends count, so a click inside another
   label's box puts the chosen one's end down there: the face a line should end in is as
   likely as any to have a word printed in it. */
function labelAt(q, endsOnly) {
  let best = null, bd = W(HIT_PX + 3);
  for (const L of S.d.labels) {
    const e = endOf(L), d = Math.hypot(e[0] - q[0], e[1] - q[1]);
    if (d < bd) { bd = d; best = L; }
  }
  if (best) return {L: best, end: true};
  if (endsOnly) return null;
  for (const L of S.d.labels) if (pip(L.box, q[0], q[1])) return {L, end: false};
  return null;
}

// Label L's line, to end at `at`: the seed standing in for it, made or moved.
function leaderTo(L, at) {
  const mm = toMm(at[0], at[1]);
  const pg = [round2(at[0]), round2(at[1])], m3 = [round3(mm[0]), round3(mm[1])];
  const k = leaderSeed(L);
  if (k >= 0) { S.draft.seeds[k].page_px = pg; S.draft.seeds[k].mm = m3; }
  else {
    S.draft.seeds.push({abbr: L.abbr, kind: 'positive', page_px: pg, mm: m3, note: '',
      label_index: L.index});
  }
  marked();
}

/* A move of L's line is over. Brought back to where it ended, it is no move at all; else
   the region it names is the one being worked on now, and the face it lands in is read. */
function leaderDone(L) {
  const k = leaderSeed(L);
  S.lead = null;
  if (k >= 0) {
    const q = S.draft.seeds[k].page_px;
    if (Math.hypot(q[0] - L.at[0], q[1] - L.at[1]) < W(4)) {
      S.draft.seeds.splice(k, 1);
      toast('The line of ' + L.abbr + '[' + L.index + '] is back where it was: no move');
    }
  }
  if (L.abbr !== S.abbr) select(L.abbr);
  renderMarks(); renderOpts(); draw();
  const at = leaderSeed(L) >= 0 ? S.draft.seeds[leaderSeed(L)].page_px : null;
  if (!at) return;
  // what build_region_extents does with the end: seeds the face it is in, where that face
  // is one a seed may hold; else the largest such face in reach of it, or nothing
  const who = L.abbr + '[' + L.index + ']';
  probe(at, (r) => {
    const min = r.min_face_px || S.d.min_face_px;
    const others = r.names.filter((n) => n !== L.abbr);
    return r.face && r.face_px >= min
      ? '\n  -> the line of ' + who + ' ends here now: the label’s own seed withdraws, and '
        + 'this face is seeded as ' + L.abbr + (others.length ? ' beside ' + others.join(', ')
        + ', which seed it today, and the watershed splits it between them' : '') + '.'
      : '\n  -> the line of ' + who + ' ends here now, ' + (r.face
        ? 'in a face of ' + r.face_px + ' px, under the ' + min + ' px a seed needs'
        : 'on a traced line or outside the section')
        + ': the pipeline seeds the largest face in reach of it instead, or none. '
        + 'Put the end inside the face the label means.';
  });
}

function chooseLabel(L) {
  if (isFeature(L.abbr)) {
    toast(L.abbr + ' is a feature of the drawing, not a region: a correction cannot move its line', true);
    return;
  }
  S.lead = S.lead === L ? null : L;
  renderOpts(); draw();
}

/* --------------------------------------------------------- reshaping a shape */

/* The nearest point of a polyline, or of a ring, to `at`: the edge it is on, how far
   along, and where. */
function onShape(pts, closed, at) {
  const n = pts.length, m = closed ? n : n - 1;
  let best = null;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy;
    const t = L2 ? Math.max(0, Math.min(1, ((at[0] - a[0]) * vx + (at[1] - a[1]) * vy) / L2)) : 0;
    const q = [a[0] + t * vx, a[1] + t * vy], d = Math.hypot(q[0] - at[0], q[1] - at[1]);
    if (!best || d < best.d) best = {i, t, pt: q, d};
  }
  return best;
}

// consecutive points closer than a hundredth of a pixel are one point
function dedupe(pts, closed) {
  const out = [];
  for (const q of pts) {
    const l = out[out.length - 1];
    if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.01) out.push(q);
  }
  while (closed && out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0],
    out[0][1] - out[out.length - 1][1]) <= 0.01) out.pop();
  return out;
}

/* The shape with a stretch of it replaced by `route`. The route's first and last points are
   put on the shape -- they are where the new line leaves it and where it rejoins -- and
   what lies between them is dropped: on a line, the run between the two; on a ring, the
   shorter of its two sides, or the longer one where `flip` says so. Returns the new points
   and the stretch they replace, or null where the route does not make a shape. */
function splice(pts, closed, route, flip) {
  if (route.length < 2 || pts.length < 2) return null;
  let A = onShape(pts, closed, route[0]), B = onShape(pts, closed, route[route.length - 1]);
  let mid = route.slice(1, -1);
  const n = pts.length;
  if (!closed) {
    if (A.i + A.t > B.i + B.t) { [A, B] = [B, A]; mid = mid.slice().reverse(); }
    const out = dedupe(pts.slice(0, A.i + 1).concat([A.pt], mid, [B.pt], pts.slice(B.i + 1)), false);
    return out.length >= 2
      ? {pts: out, gone: [A.pt].concat(pts.slice(A.i + 1, B.i + 1), [B.pt])} : null;
  }
  const seg = (i) => Math.hypot(pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]);
  const cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + seg(i));
  const per = cum[n];
  const sA = cum[A.i] + A.t * seg(A.i), sB = cum[B.i] + B.t * seg(B.i);
  const ahead = (s0, s1) => (((s1 - s0) % per) + per) % per;
  const lenAB = ahead(sA, sB);
  if (lenAB < 1e-6 || per - lenAB < 1e-6) return null;
  // the vertices strictly between two places on the ring, going forward from the first
  const between = (P0, s0, len) => {
    const out = [];
    for (let k = 1; k <= n; k++) {
      const v = (P0.i + k) % n, d = ahead(s0, cum[v]);
      if (d >= len - 1e-9) break;
      if (d > 1e-9) out.push(pts[v]);
    }
    return out;
  };
  const ab = between(A, sA, lenAB), ba = between(B, sB, per - lenAB);
  const dropAB = (lenAB <= per - lenAB) !== !!flip;
  const head = [A.pt].concat(mid, [B.pt]);
  const out = dedupe(dropAB ? head.concat(ba) : head.concat(ab.slice().reverse()), true);
  if (out.length < 3) return null;
  return {pts: out, gone: dropAB ? [A.pt].concat(ab, [B.pt]) : [B.pt].concat(ba, [A.pt])};
}

// the redraw in hand, with the pointer as its last point while it is still being drawn
function redrawn(p, final) {
  const rp = p.redraw.pts;
  const route = !final && S.at && !PTR.size ? rp.concat([S.snapAt || S.at]) : rp;
  return splice(p.pts, p.kind === 'extent' || !!p.closed, route, p.redraw.flip);
}

function openEditor(key, i) {
  const m = S.draft[key][i];
  S.pending = {kind: key === 'extents' ? 'extent' : 'boundary', edit: true,
    pts: m.page_px.map((q) => q.slice()), abbr: m.abbr, ekind: m.kind, ring: m.ring,
    closed: key === 'extents' || !!m.closed, style: m.style || 'solid',
    src: {key, i}, hist: [], sel: -1, redraw: null, opened: performance.now()};
  if (key === 'boundaries') { S.opts.style = S.pending.style; S.opts.closed = S.pending.closed; }
  renderOpts(); draw();
}

// the editor's own undo: the points as they were before each step
function stepPending() {
  const p = S.pending;
  p.hist.push(p.pts.map((q) => q.slice()));
  if (p.hist.length > 300) p.hist.shift();
}

function deleteVertex(i) {
  const p = S.pending, ring = p.kind === 'extent' || p.closed;
  if (p.pts.length <= (ring ? 3 : 2)) {
    toast(ring ? 'An outline keeps three points at least' : 'A line keeps two points at least', true);
    return;
  }
  stepPending();
  p.pts.splice(i, 1);
  p.sel = -1;
  draw(); hintFor();
}

function startRedraw() {
  const p = S.pending;
  if (!p || !p.edit) return;
  p.redraw = p.redraw ? null : {pts: [], flip: false};
  p.sel = -1;
  draw(); hintFor();
}

function applyRedraw() {
  const p = S.pending, r = redrawn(p, true);
  if (!r) {
    toast(p.redraw.pts.length < 2 ? 'The new line needs a point where it leaves the shape and one where it rejoins'
      : 'That line does not make a shape: it leaves and rejoins at one place', true);
    return;
  }
  stepPending();
  p.pts = r.pts;
  p.redraw = null;
  draw(); hintFor();
}

/* ------------------------------------------------------------------ pointer */

/* One gesture model for a mouse and for fingers, which is what makes the page work on
   a phone: a tap acts, a drag pans, two fingers pinch -- and a drag that starts on
   something that can be moved moves it instead: a point of a shape, an edge of one (which
   puts a point there), a seed, the end of a label's line. A press that never travels
   further than TAP_PX is a tap however it was made, so the same code answers a click and
   a fingertip, and the tool acts on release rather than on press -- which is also what
   lets a drag out of a mis-aimed press be taken back. */
const TAP_PX = 6;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const HIT_PX = TOUCH ? 16 : 9;         // screen px: how near a press has to be to take hold
const PTR = new Map();                 // the pointers down, in canvas-local px
let G = null;                          // the gesture in progress

function local(ev) {
  const r = cv.getBoundingClientRect();
  return [ev.clientX - r.left, ev.clientY - r.top];
}
function pageOf(pt) { const q = viewOf(pt); return xf(inv6(S.rot), q[0], q[1]); }
function twoPointers() {
  const [a, b] = [...PTR.values()];
  return {mid: [(a.at[0] + b.at[0]) / 2, (a.at[1] + b.at[1]) / 2],
    d: Math.max(1, Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]))};
}
function setPan(on) { document.querySelector('.stage').classList.toggle('pan', !!on); }

function nearVertex(pts, at) {
  let best = -1, bd = W(HIT_PX);
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - at[0], pts[i][1] - at[1]);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function nearEdge(pts, at, closed) {
  const q = pts.length > 1 ? onShape(pts, closed, at) : null;
  return q && q.d < W(HIT_PX * 0.8) ? q : null;
}
function nearSeed(at) {
  let best = -1, bd = W(HIT_PX);
  S.draft.seeds.forEach((s, i) => {
    if (isLead(s)) return;
    const d = Math.hypot(s.page_px[0] - at[0], s.page_px[1] - at[1]);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

/* What a press at page point `q` would take hold of, for the tool in hand. */
function grabAt(q) {
  const p = S.pending;
  if (p) {
    if (!p.edit || p.redraw) return null;
    const i = nearVertex(p.pts, q);
    if (i >= 0) return {kind: 'vertex', i};
    const e = nearEdge(p.pts, q, p.kind === 'extent' || !!p.closed);
    return e ? {kind: 'edge', e: e.i, pt: e.pt} : null;
  }
  if (S.tool === 'boundary' || S.tool === 'extent') {
    // a point of a shape already drawn: the press opens it, and moves the point
    const key = S.tool === 'extent' ? 'extents' : 'boundaries', L = S.draft[key];
    for (let m = L.length - 1; m >= 0; m--) {
      const i = nearVertex(L[m].page_px, q);
      if (i >= 0) return {kind: 'mark', key, m, i};
    }
    return null;
  }
  if (S.tool === 'seed' || S.tool === 'unseed') {
    const i = nearSeed(q);
    return i >= 0 ? {kind: 'seed', i} : null;
  }
  if (S.tool === 'leader') {
    const hit = labelAt(q, !!S.lead);
    return hit ? {kind: 'label', L: hit.L, end: hit.end} : null;
  }
  return null;
}

cv.addEventListener('pointerdown', (ev) => {
  if (!S.d) return;
  ev.preventDefault();
  // which also keeps the focus from moving, so it is moved here: a key pressed next is for
  // the plate, not for the box that was ticked or the field that was typed in before it
  const had = document.activeElement;
  if (had && had !== document.body && had.blur) had.blur();
  try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* a synthetic pointer */ }
  const at = local(ev);
  PTR.set(ev.pointerId, {at, from: at});
  if (PTR.size === 2) {                                  // a second finger: pinch
    const t = twoPointers();
    G = {kind: 'pinch', d0: t.d, v0: Object.assign({}, S.view), p0: viewOf(t.mid)};
    setPan(true);
    return;
  }
  if (PTR.size > 2 || ev.button > 0 && ev.button !== 1 && ev.button !== 2) return;
  const q = pageOf(at);
  const g = ev.button === 0 && !ev.shiftKey ? grabAt(q) : null;
  if (g) {
    if (g.kind === 'vertex' && ev.altKey) { deleteVertex(g.i); return; }
    if (g.kind === 'mark') {
      openEditor(g.key, g.m);
      G = {kind: 'vertex', i: g.i, from: at, moved: false};
    } else {
      G = Object.assign(g, {from: at, moved: false});
    }
    if (G.kind === 'vertex') S.pending.sel = G.i;
    S.hover = null;
    draw(); drawbar();
    return;
  }
  G = {kind: 'pan', from: at, v0: Object.assign({}, S.view), travelled: 0,
    tap: ev.button === 0 && !ev.shiftKey};
});

cv.addEventListener('pointermove', (ev) => {
  if (!S.d) return;
  const at = local(ev);
  const held = PTR.get(ev.pointerId);
  if (held) held.at = at;
  if (G && G.kind === 'pinch' && PTR.size >= 2) {
    const t = twoPointers();
    const k = Math.max(0.02, Math.min(40, G.v0.k * t.d / G.d0));
    S.fitted = false;
    S.view = {k, x: t.mid[0] - G.p0[0] * k, y: t.mid[1] - G.p0[1] * k};
    redraw();
    return;
  }
  const q = pageOf(at);
  S.at = q;
  if (G && G.kind !== 'pan' && G.kind !== 'pinch' && held) {
    // half a tap's travel before anything moves, so a click that trembles moves nothing
    if (!G.moved && Math.hypot(at[0] - G.from[0], at[1] - G.from[1]) <= TAP_PX / 2) return;
    dragTo(G, q);
    readout(q);
    return;
  }
  if (G && G.kind === 'pan' && held) {
    G.travelled = Math.max(G.travelled, Math.hypot(at[0] - G.from[0], at[1] - G.from[1]));
    if (G.travelled > TAP_PX) {
      G.tap = false;
      S.fitted = false;
      setPan(true);
      S.view = {k: G.v0.k, x: G.v0.x + at[0] - G.from[0], y: G.v0.y + at[1] - G.from[1]};
      redraw();
      return;
    }
  }
  hoverAt(q);
  readout(q);
});

function dragTo(g, q) {
  if (g.kind === 'label' && isFeature(g.L.abbr)) return;   // on release, it says why
  if (g.kind === 'label' && !g.end) {              // a drag from a word pans
    G = {kind: 'pan', from: g.from, v0: Object.assign({}, S.view), travelled: TAP_PX + 1, tap: false};
    setPan(true);
    return;
  }
  const first = !g.moved;
  g.moved = true;
  const p = S.pending;
  if (g.kind === 'edge') {                         // bending an edge puts a point on it
    stepPending();
    p.pts.splice(g.e + 1, 0, q);
    g.kind = 'vertex'; g.i = g.e + 1;
  } else if (g.kind === 'vertex' && first) stepPending();
  if (g.kind === 'vertex') {
    const s = snapPt(q, p);
    S.snapAt = s === q ? null : s;
    p.pts[g.i] = s;
    p.sel = g.i;
  } else if (g.kind === 'seed') {
    if (first) remember();
    const s = S.draft.seeds[g.i], mm = toMm(q[0], q[1]);
    s.page_px = [round2(q[0]), round2(q[1])]; s.mm = [round3(mm[0]), round3(mm[1])];
    marked();
  } else if (g.kind === 'label') {
    if (first) remember();
    leaderTo(g.L, q);
  }
  redraw();
}

const hoverKey = (h) => (!h ? '' : h.kind === 'label' ? 'label ' + h.L.abbr + '[' + h.L.index + ']' + h.end
  : h.kind === 'mark' ? 'mark ' + h.key + h.m + ':' + h.i : h.kind + ' ' + (h.kind === 'edge' ? h.e : h.i));

/* What the pointer is over: the cursor says what a press would do, the plate shows the
   point it would take, and a drawing tool shows where on the ink a point would snap to. */
function hoverAt(q) {
  const p = S.pending;
  let h = null, cur = 'crosshair';
  if (!PTR.size) {
    h = grabAt(q);
    if (h) {
      cur = h.kind === 'edge' ? 'copy' : h.kind === 'label'
        ? (isFeature(h.L.abbr) ? 'not-allowed' : h.end ? 'grab' : 'pointer') : 'move';
    }
  }
  const snaps = S.opts.snap && !h && (p ? (!p.edit || (p.redraw && p.redraw.pts.length > 0))
    : S.tool === 'boundary' || (S.tool === 'extent' && !!S.abbr));
  let to = snaps ? (nearInk(q, W(SNAP_PX), skipOf(p)) || {}).pt || null : null;
  // a new line's first point goes on the shape it leaves: show where
  if (p && p.redraw && !p.redraw.pts.length) to = onShape(p.pts, p.kind === 'extent' || !!p.closed, q).pt;
  const was = hoverKey(S.hover) + '|' + S.snapAt;
  S.hover = h;
  S.snapAt = to;
  if (cur === 'not-allowed') cv.style.cursor = 'not-allowed'; else cv.style.cursor = '';
  cv.dataset.cur = cur;
  const now = hoverKey(h) + '|' + S.snapAt;
  // a shape being drawn follows the pointer; anything else redraws only when it changes
  if (now !== was || (h && h.kind === 'edge') || (p && (!p.edit || p.redraw))) redraw();
}

function done(ev) {
  const held = PTR.get(ev.pointerId);
  PTR.delete(ev.pointerId);
  if (!G) return;
  const g = G, up = ev.type === 'pointerup';
  if (g.kind === 'pan' && g.tap && held && up) {
    const at = pageOf(held.at);
    S.at = at;
    readout(at);
    tap(at, ev);
  } else if (g.kind === 'edge' && !g.moved && up) {
    stepPending();                                 // a tap on an edge: a point there
    S.pending.pts.splice(g.e + 1, 0, g.pt);
    S.pending.sel = g.e + 1;
    draw(); hintFor();
  } else if (g.kind === 'vertex') {
    S.snapAt = null;
    draw(); hintFor();
  } else if (g.kind === 'seed') {
    if (g.moved) { renderMarks(); probe(S.draft.seeds[g.i].page_px); }
    else if (held && up) probe(pageOf(held.at));
  } else if (g.kind === 'label') {
    if (g.moved) leaderDone(g.L);
    else if (up) chooseLabel(g.L);
  }
  if (PTR.size === 0) { G = null; setPan(false); }
  else if (g.kind === 'pinch' && PTR.size === 1) {     // a finger lifted: carry on panning
    const rest = [...PTR.values()][0];
    G = {kind: 'pan', from: rest.at, v0: Object.assign({}, S.view), travelled: 99, tap: false};
  }
}
cv.addEventListener('pointerup', done);
cv.addEventListener('pointercancel', done);
cv.addEventListener('pointerleave', () => {
  if (PTR.size) return;
  S.hover = null; S.snapAt = null;
  redraw();
});
cv.addEventListener('dblclick', (ev) => {
  ev.preventDefault();
  const p = S.pending;
  if (!p) return;
  if (p.edit && !p.redraw) {                    // a double click on a point takes it out,
    // unless it was that double click's first press that opened the shape
    if (p.opened && performance.now() - p.opened < 800) return;
    const i = nearVertex(p.pts, pageOf(local(ev)));
    if (i >= 0) deleteVertex(i);
    return;
  }
  finish();
});
cv.addEventListener('contextmenu', (ev) => ev.preventDefault());
cv.addEventListener('wheel', (ev) => {
  if (!S.d) return;
  ev.preventDefault();
  const at = local(ev);
  const f = Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0015));
  zoomBy(f, at);
}, {passive: false});

function zoomBy(f, about) {
  S.fitted = false;
  const r = cv.getBoundingClientRect(), v = S.view;
  const at = about || [r.width / 2, r.height / 2];
  const k = Math.max(0.02, Math.min(40, v.k * f));
  S.view = {k, x: at[0] - (at[0] - v.x) * k / v.k, y: at[1] - (at[1] - v.y) * k / v.k};
  draw();
}

function readout(q) {
  const mm = toMm(q[0], q[1]);
  $('at').textContent = 'ML ' + fmt(mm[0]) + '  DV ' + fmt(mm[1]) + ' mm   ·   page '
    + q[0].toFixed(0) + ', ' + q[1].toFixed(0);
  const reg = regionAt(q[0], q[1]);
  $('under').textContent = reg ? reg.abbr + ' — ' + reg.name : '';
}

// how near, in screen px, a press has to be to a point already put down to be taken as
// that point again: a double press on the last one ends a line, a press on the first one
// closes an outline. Held small, and smaller than a finger's reach for anything else, so
// the next point of a line drawn at a distant zoom can still go down close to the last.
const SAME_PX = 4, CLOSE_PX = 10;
const near = (a, b, px) => Math.hypot(a[0] - b[0], a[1] - b[1]) < W(px);

/* A tap that took hold of nothing: a point of the shape being drawn or of a new line
   being routed, a mark, or a reading of the plate. */
function tap(at, ev) {
  const p = S.pending;
  if (p && p.redraw) {
    const rp = p.redraw.pts;
    // the first point of the new line is where it leaves the shape, so it goes on it
    const q = rp.length ? snapPt(at, p) : onShape(p.pts, p.kind === 'extent' || !!p.closed, at).pt;
    if (rp.length >= 2 && near(q, rp[rp.length - 1], SAME_PX)) { applyRedraw(); return; }
    if (rp.length && near(q, rp[rp.length - 1], SAME_PX)) return;
    rp.push(q);
    draw(); hintFor();
    return;
  }
  if (p && p.edit) { p.sel = -1; draw(); hintFor(); return; }   // let go of the chosen point
  if (p) { addPoint(at); return; }
  click(at, ev);
}

function addPoint(at) {
  const p = S.pending, q = snapPt(at, p), n = p.pts.length;
  // the first point again closes an outline, and the last point again ends a line
  if (p.kind === 'extent' && n >= 3 && (near(q, p.pts[0], CLOSE_PX) || near(q, p.pts[n - 1], SAME_PX))) {
    finish(); return;
  }
  if (p.kind === 'boundary' && n >= 2 && near(q, p.pts[n - 1], SAME_PX)) { finish(); return; }
  if (n && near(q, p.pts[n - 1], SAME_PX)) return;   // a double click's second press
  p.pts.push(q);
  S.snapAt = null;
  draw(); hintFor();
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
    remember();
    S.draft.seeds.push({abbr: S.abbr, kind: S.tool === 'seed' ? 'positive' : 'negative',
      page_px: [round2(at[0]), round2(at[1])], mm: [round3(mm[0]), round3(mm[1])], note: ''});
    marked();
    renderMarks(); draw();
    await probe(at);
    return;
  }
  if (S.tool === 'leader') {
    if (S.lead) {                                  // the chosen label's line, to end here
      const L = S.lead;
      remember();
      leaderTo(L, at);
      leaderDone(L);
      return;
    }
    await probe(at);
    return;
  }
  if (S.tool === 'boundary') {
    S.pending = {kind: 'boundary', pts: [snapPt(at, null)], abbr: S.abbr, style: S.opts.style,
      closed: S.opts.closed, hist: [], sel: -1, redraw: null};
    S.snapAt = null;
    draw(); hintFor();
    return;
  }
  if (S.tool === 'extent') {
    if (!S.abbr) { toast('Choose the region first', true); return; }
    S.pending = {kind: 'extent', pts: [snapPt(at, null)], abbr: S.abbr, ekind: S.opts.extkind,
      hist: [], sel: -1, redraw: null};
    S.snapAt = null;
    draw(); hintFor();
  }
}

const round2 = (v) => Math.round(v * 100) / 100;
const round3 = (v) => Math.round(v * 1000) / 1000;

// A mark was added or taken away: whatever Recut showed no longer describes the draft.
function marked() { S.draft.preview = null; }

/* The draft's marks as they stand, put by before a change, so Undo takes back the last
   change whatever it was -- a seed, a line, a move, a drop -- rather than the last of
   whichever kind happens to be listed first. A note is not a mark, and taking one back
   leaves what Recut showed standing. */
function remember(note) {
  const D = S.draft;
  const h = S.hist.get(D.plate) || [];
  h.push({note: !!note, marks: JSON.stringify({seeds: D.seeds, boundaries: D.boundaries,
    extents: D.extents, notes: D.notes})});
  if (h.length > 200) h.shift();
  S.hist.set(D.plate, h);
}

async function probe(at, more) {
  try {
    const r = await SRC.probe(S.plate, [at[0], at[1]], S.draft);
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
      + (r.face && !r.names.length ? '\n  -> an unlettered face: a seed names it.' : '')
      + (typeof more === 'function' ? more(r) : more || ''));
  } catch (e) { report(String(e.message), true); }
}

function finish() {
  const p = S.pending;
  if (!p) return;
  if (p.redraw) { applyRedraw(); return; }
  if (p.pts.length < (p.kind === 'extent' ? 3 : 2)) {
    if (!p.edit) { S.pending = null; draw(); hintFor(); }
    return;
  }
  if (p.src && !p.hist.length && (p.kind !== 'boundary' || (S.draft.boundaries[p.src.i].style === p.style
    && !!S.draft.boundaries[p.src.i].closed === !!p.closed))) {
    S.pending = null; draw(); hintFor();              // opened and left as it was
    return;
  }
  const pg = p.pts.map((q) => [round2(q[0]), round2(q[1])]);
  const mm = p.pts.map((q) => toMm(q[0], q[1]).map(round3));
  remember();
  if (p.src) {
    const m = S.draft[p.src.key][p.src.i];
    m.page_px = pg; m.mm = mm;
    if (p.kind === 'boundary') { m.style = p.style; m.closed = !!p.closed; }
  } else if (p.kind === 'boundary') {
    // a boundary is a run of the tracing and names no region, but it is sent with the
    // region that was chosen when it was drawn, so a plate marked for two goes as two
    S.draft.boundaries.push({abbr: p.abbr || S.abbr, style: p.style, closed: !!p.closed,
      page_px: pg, mm, note: ''});
  } else {
    S.draft.extents.push({abbr: p.abbr || S.abbr, kind: p.ekind || 'positive',
      page_px: pg, mm, note: '', ring: p.ring === undefined ? null : p.ring});
  }
  S.pending = null;
  marked();
  renderMarks(); renderOpts(); draw(); hintFor();      // and the ring list, which says what is marked
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
  renderRegions(); selectFacts(); renderOpts(); sheetLabel(); draw();
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

const SNAPBOX = '<label class="chk" title="A point put down near traced ink goes on the ink itself, '
  + 'which is where the pipeline needs a line to start and end (G)"><input type="checkbox" '
  + 'id="o-snap"> snap to the ink</label>';

function renderOpts() {
  const el = $('opts');
  el.innerHTML = '';
  const add = (html) => { const d = document.createElement('div'); d.className = 'grp wrap'; d.innerHTML = html; el.appendChild(d); return d; };
  const snapbox = (d) => {
    const c = d.querySelector('#o-snap');
    c.checked = S.opts.snap;
    c.onchange = () => { S.opts.snap = c.checked; S.snapAt = null; draw(); hintFor(); };
  };
  if (S.tool === 'boundary') {
    const d = add('<div class="seg"><button type="button" data-s="solid">solid</button>'
      + '<button type="button" data-s="dashed">dashed</button></div>'
      + '<label class="chk"><input type="checkbox" id="o-closed"> a ring</label>' + SNAPBOX);
    for (const b of d.querySelectorAll('[data-s]')) {
      b.className = b.dataset.s === S.opts.style ? 'on' : '';
      b.onclick = () => {
        S.opts.style = b.dataset.s;
        if (S.pending && S.pending.kind === 'boundary') S.pending.style = S.opts.style;
        renderOpts(); draw();
      };
    }
    const c = d.querySelector('#o-closed');
    c.checked = S.opts.closed;
    c.onchange = () => {
      S.opts.closed = c.checked;
      if (S.pending && S.pending.kind === 'boundary') S.pending.closed = c.checked;
      draw(); hintFor();
    };
    snapbox(d);
  } else if (S.tool === 'extent') {
    // an outline the region should have, or one it should not: a hole in a ring-like
    // region, or a ring the extraction gave it and the atlas does not draw
    const d = add('<div class="seg full" id="o-ekind">'
      + '<button type="button" data-k="positive" title="Extent +: the outline the region should have">'
      + 'the region is here</button>'
      + '<button type="button" data-k="negative" title="Extent −: the region has no area inside this: '
      + 'the hole in a ring-like region, or a piece the extraction gave it">'
      + 'it is not here</button></div>');
    for (const b of d.querySelectorAll('[data-k]')) {
      b.className = b.dataset.k === S.opts.extkind ? 'on' : '';
      b.onclick = () => { S.opts.extkind = b.dataset.k; cancelPending(); renderOpts(); draw(); };
    }
    snapbox(add(SNAPBOX));
    const rings = document.createElement('div');
    rings.className = 'rings';
    el.appendChild(rings);
    const r = S.d && S.abbr ? S.d.regions.find((x) => x.abbr === S.abbr) : null;
    if (!S.abbr) rings.innerHTML = '<p class="fact">Choose the region first.</p>';
    else if (!r) {
      rings.innerHTML = '<p class="fact">' + esc(S.abbr) + ' has no area on this plate: '
        + TAPPED.toLowerCase() + ' the plate to draw the outline it should have.</p>';
    } else r.rings.forEach((g, i) => rings.appendChild(ringRow(g, i)));
  } else if (S.tool === 'leader') {
    const box = document.createElement('div');
    box.className = 'leads';
    el.appendChild(box);
    const Ls = S.d && S.abbr ? S.d.labels.filter((L) => L.abbr === S.abbr) : [];
    if (!S.abbr) box.innerHTML = '<p class="fact">Choose a region to list its labels here, or take hold of any label on the plate.</p>';
    else if (isFeature(S.abbr)) {
      box.innerHTML = '<p class="fact">' + esc(S.abbr) + ' is a feature of the drawing, not a region: '
        + 'a correction cannot move its line.</p>';
    } else if (!Ls.length) {
      box.innerHTML = '<p class="fact">The plate prints no ' + esc(S.abbr) + ' label to move. '
        + '<b>Seed +</b> seeds it without one.</p>';
    } else Ls.forEach((L) => box.appendChild(leadRow(L)));
  }
  renderHelp();
  hintFor();
}

/* One ring of the chosen region as the extraction cut it, and the two things that can
   be said about it: pull it into shape, or drop it. Dropping writes the ring's own
   vertices as a negative extent -- the piece the cut made, not a hand-drawn guess at
   it -- and the same button takes the drop back, which is the only thing that removes
   it besides the mark's own x. A ring already pulled into shape opens that shape again
   rather than starting a second one from the cut. A region is as many rings as the atlas
   draws it places; another one is drawn on the plate. */
function ringRow(ring, i) {
  const row = document.createElement('div');
  row.className = 'ring';
  row.innerHTML = '<span class="who"></span>';
  const g = openRing(ring);
  const c = g.reduce((a, q) => [a[0] + q[0] / g.length, a[1] + q[1] / g.length], [0, 0]);
  const area = Math.abs(ringArea(g)) * S.d.mm2_per_px;
  const at = S.draft.extents.findIndex((e) => e.kind === 'negative' && e.ring === i);
  const pulled = S.draft.extents.findIndex((e) => e.kind !== 'negative' && e.ring === i);
  row.children[0].textContent = 'ring ' + (i + 1) + ' · ' + (toMm(c[0], c[1])[0] < 0 ? 'left' : 'right')
    + ' · ' + area.toFixed(4) + ' mm²'
    + (at >= 0 ? ' · dropped' : pulled >= 0 ? ' · pulled into shape' : '');
  row.children[0].title = 'Zoom to ring ' + (i + 1);
  row.children[0].style.cursor = 'zoom-in';
  row.children[0].onclick = () => zoomTo(g);
  const btn = (label, title, cls, fn) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'b' + (cls ? ' ' + cls : ''); b.textContent = label;
    b.title = title; b.disabled = !fn; b.onclick = fn || null;
    row.appendChild(b);
  };
  if (at >= 0) {
    btn('Keep', 'Take back the drop: leave ring ' + (i + 1) + ' as the extraction cut it',
      '', () => {
        remember();
        S.draft.extents.splice(at, 1); marked(); renderMarks(); renderOpts(); draw();
      });
    return row;
  }
  if (pulled >= 0) {
    btn('Edit the shape', 'Open the outline ring ' + (i + 1) + ' was pulled into, and go on with it', '', () => {
      cancelPending();
      openEditor('extents', pulled);
      zoomTo(S.draft.extents[pulled].page_px);
    });
  } else {
    btn('Pull into shape', 'Drag its points, or redraw a stretch of it, into the outline the region should have', '', () => {
      cancelPending();
      S.pending = {kind: 'extent', pts: g.map((q) => q.slice()), edit: true, abbr: S.abbr,
        ekind: 'positive', ring: i, closed: true, hist: [], sel: -1, redraw: null};
      zoomTo(g); hintFor();
    });
  }
  // the two readings of a ring contradict each other, so the second is not offered
  // while the first stands: drop the mark that holds it and the button comes back
  btn('Drop', pulled >= 0 ? 'Ring ' + (i + 1) + ' is already pulled into shape; drop that mark '
    + 'first' : 'The region should have no area here: ring ' + (i + 1) + ' goes in as an '
    + 'extent that says so', 'warn', pulled >= 0 ? null : () => {
    cancelPending();
    remember();
    S.draft.extents.push({abbr: S.abbr, kind: 'negative', ring: i,
      page_px: g.map((q) => [round2(q[0]), round2(q[1])]),
      mm: g.map((q) => toMm(q[0], q[1]).map(round3)), note: ''});
    marked(); renderMarks(); renderOpts(); draw();
    toast('ring ' + (i + 1) + ' of ' + S.abbr + ': marked as area it should not have');
  });
  return row;
}

/* One printed label of the chosen region, what its line does, and what can be done with
   it: find it, choose it to put its end down by a tap, or take back a move. */
function leadRow(L) {
  const row = document.createElement('div');
  const k = leaderSeed(L);
  row.className = 'lead' + (S.lead === L ? ' on' : '');
  const how = k >= 0 ? 'moved in this draft' : L.byhand ? 'moved by an earlier correction'
    : L.led ? 'on a line' : 'seeds at the word';
  row.innerHTML = '<span class="who"><b></b> · <span></span></span>';
  row.querySelector('b').textContent = L.abbr + '[' + L.index + ']';
  row.querySelector('.who span').textContent = how;
  const btn = (label, title, fn, cls) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'b' + (cls ? ' ' + cls : ''); b.textContent = label; b.title = title;
    b.onclick = fn;
    row.appendChild(b);
  };
  btn('Show', 'Zoom to the label and where it seeds', () => zoomTo(L.box.concat([endOf(L), L.at]), 120));
  btn(S.lead === L ? 'Choosing…' : 'Move', S.lead === L ? 'Let it go (Esc)'
    : 'Choose it, then ' + TAPPED.toLowerCase() + ' the plate where its line should end', () => chooseLabel(L));
  if (k >= 0) {
    btn('Reset', 'Take back the move: the line ends where the plate has it', () => {
      remember();
      S.draft.seeds.splice(leaderSeed(L), 1);
      marked(); renderMarks(); renderOpts(); draw();
    }, 'warn');
  }
  return row;
}

/* A ring with the point that closes it dropped, which is how a mark carries one: the
   extraction writes the first vertex again at the end, and an extent in a correction
   does not -- so this is the same ring, said the way the file says it. */
function openRing(g) {
  const n = g.length;
  return n > 3 && g[0][0] === g[n - 1][0] && g[0][1] === g[n - 1][1] ? g.slice(0, -1) : g;
}

// shoelace, in page px; the sign carries the ring's orientation, so a hole reads negative
function ringArea(g) {
  let a = 0;
  for (let i = 0, j = g.length - 1; i < g.length; j = i++) {
    a += (g[j][0] + g[i][0]) * (g[j][1] - g[i][1]);
  }
  return a / 2;
}

/* What each mark says, what the pipeline does with it, and when it is the one to use.
   The six are easy to confuse -- a seed and a leader both seed, a boundary and an extent
   both draw a line -- and the difference is what the pipeline does with each, so that is
   what is said. Every claim here is tools/corrections.py's: `apply` writes positive
   seeds into seed_overrides, boundaries and the off-ink runs of a positive extent into
   the plate's SVG, and nothing else; a negative seed or extent is read by `inspect` and
   by the session, never written. */
const TOOLS = {
  pick: {name: 'Pick', color: '--pick', says: 'nothing: it reads the plate, and adds no mark.',
    does: 'Says which <b>face</b> the point is in (an area the traced ink closes off), which printed labels seed that face, and which region holds the point today.',
    when: 'Start here, to see why a region comes out wrong before marking it.'},
  seed: {name: 'Seed +', color: '--seed', says: '<b>{a}</b> is here.',
    does: 'Becomes a seed of its own: the face it lands in is cut as {a}.',
    when: 'A face the atlas draws for {a} that no label seeds. A face lettered for another region alone would be split by it: look for a missing boundary. To move where a printed label seeds, use <b>Leader</b>.'},
  unseed: {name: 'Seed −', color: '--unseed', says: '<b>{a}</b> is not here.',
    does: 'Points the session that applies the correction at area {a} should not hold. The pipeline does not act on it.',
    when: 'Area {a} holds wrongly: the session looks for the seed or the gap that lets it in.'},
  boundary: {name: 'Boundary', color: '--bound', says: 'a line the tracing missed runs here.',
    does: 'Added to the plate’s tracing as new ink, which splits the face it crosses. An end more than {b} page px from the ink is not bridged, and closes nothing.',
    when: 'Two regions share one face because a line is missing. Solid or dashed, as the atlas draws it.'},
  extent: {name: 'Extent +', color: '--ext', says: 'this is the outline <b>{a}</b> should have.',
    does: 'The runs of it that leave the traced ink are added to the tracing as new boundary; the whole outline tells the session the shape to reach.',
    when: 'The shape of {a} is wrong. One extent for each place the atlas draws it: pull an extracted ring into shape, or draw one where it has none.'},
  unextent: {name: 'Extent −', color: '--ext', says: '<b>{a}</b> has no area inside this.',
    does: 'Read, never inked: the session finds which seed or missing line lets {a} in.',
    when: 'The hole in a ring-shaped region, or a piece the extraction gave {a} that the atlas does not draw.'},
  leader: {name: 'Leader', color: '--seed', says: 'this label means the region its line ends in.',
    does: 'Written as a seed standing in for that printed label (<code>label_index</code>): the label’s own seed is withdrawn, and the face the new end is in is seeded instead.',
    when: 'A label’s line ends in the wrong face, or short of the region it points into. A label printed without a line seeds at the word; moving it gives it one.'},
};
const toolKey = () => (S.tool === 'extent' && S.opts.extkind === 'negative' ? 'unextent' : S.tool);
function fill(t) {
  return t.replace(/\{T\}/g, TAPPED).replace(/\{t\}/g, TAPPED.toLowerCase())
    .replace(/\{a\}/g, S.abbr ? esc(S.abbr) : 'the region')
    .replace(/\{b\}/g, S.d ? S.d.bridge_px : 20);
}
function renderHelp() {
  const t = TOOLS[toolKey()];
  const el = $('toolhelp');
  el.style.setProperty('--tc', 'var(' + t.color + ')');
  el.innerHTML = '<div class="says">' + t.name + ' <em>says</em> ' + fill(t.says) + '</div>'
    + '<p><b>What it does.</b> ' + fill(t.does) + '</p>'
    + '<p><b>Use it for:</b> ' + fill(t.when) + '</p>';
}

const TAPPED = TOUCH ? 'Tap' : 'Click';
const HINTS = {
  pick: '{T} the plate to read what the extraction has there.',
  seed: '{T} where <b>{a}</b> is. Drag a seed to move it.',
  unseed: '{T} where <b>{a}</b> is <b>not</b>. Drag a mark to move it.',
  boundary: '{T} where the missing line leaves the traced ink, then along it, and {t} the last point '
    + 'again (or <b>Finish</b>) where it rejoins. Drag a point of a line already drawn to adjust it.',
  extent: 'Pull a ring of <b>{a}</b> into shape, or {t} the plate to draw an outline point by point '
    + 'and {t} its first point to close it. Drag a point of an outline already drawn to adjust it.',
  leader: 'Drag the dot at the end of a label’s line to the face the label means — a label '
    + 'printed without a line has a ring on the word to drag. Or {t} a label, then {t} where its line should end.',
};
function hintFor() {
  let t = HINTS[S.tool] || '';
  const p = S.pending;
  if (p && p.redraw) {
    t = p.redraw.pts.length
      ? '{T} along the new line, then {t} where it rejoins the shape and <b>Apply</b>. '
        + 'The dashed red stretch is what it replaces' + (p.kind === 'extent' || p.closed
        ? '; <b>Other side</b> swaps it for the rest of the ring.' : '.')
      : '{T} the shape where the new line leaves it.';
  } else if (p && p.edit) {
    t = 'Drag a point to move it, or an edge to bend it. ' + (TOUCH
      ? 'Tap a point and <b>Delete point</b> to take it out.'
      : 'Click a point and press Delete, or double-click it, to take it out.')
      + ' <b>Redraw a stretch</b> replaces a run of it with a line you {t}. <b>Accept</b> keeps it.';
  } else if (p) {
    const n = p.pts.length, neg = p.ekind === 'negative';
    t = n + (n === 1 ? ' point' : ' points') + ' so far. ' + (p.kind === 'extent'
      ? '{T} the first point, or <b>Finish</b>, to close the outline'
        + (neg ? '; it goes in as area <b>{a}</b> should not have.' : '.')
      : '{T} the last point again, or <b>Finish</b>, where the line rejoins the ink.');
  } else if (S.tool === 'leader' && S.lead) {
    t = '<b>' + esc(S.lead.abbr + '[' + S.lead.index + ']') + '</b> is chosen: {t} the plate where '
      + 'its line should end, or press Esc.';
  }
  if (p && !p.edit && S.opts.snap) t += ' A point near the ink snaps onto it.';
  $('hint').innerHTML = fill(t);
  drawbar();
  sheetLabel();
}

/* What the sheet bar says while it is all that is up, so a phone can see the state
   it is in without opening the panel. */
function sheetLabel() {
  const D = S.draft;
  const n = D.seeds.length + D.boundaries.length + D.extents.length;
  const tool = {pick: 'Pick', seed: 'Seed +', unseed: 'Seed −', boundary: 'Boundary',
    extent: 'Extent ' + (S.opts.extkind === 'negative' ? '−' : '+'), leader: 'Leader'}[S.tool];
  $('sheetwhat').textContent = (S.abbr || 'no region') + ' · ' + tool
    + (n ? ' · ' + n + ' mark' + (n === 1 ? '' : 's') : '') + ' · the tools';
}

// A shape being drawn says on the plate how to finish it: a phone has no Enter key,
// and a double-tap is not a double-click.
function drawbar() {
  const p = S.pending;
  $('drawbar').hidden = !p;
  if (!p) return;
  const n = p.pts.length, rd = p.redraw, ring = p.kind === 'extent' || !!p.closed;
  $('drawcount').textContent = rd ? 'new line: ' + rd.pts.length + (rd.pts.length === 1 ? ' point' : ' points')
    : p.edit ? n + ' vertices' : n + (n === 1 ? ' point' : ' points');
  $('dredraw').hidden = !p.edit || !!rd;
  $('dflip').hidden = !rd || !ring;
  $('ddel').hidden = !p.edit || !!rd || !(p.sel >= 0);
  $('dundo').textContent = p.edit && !rd ? 'Undo' : 'Undo point';
  $('dundo').disabled = p.edit && !rd ? !p.hist.length : false;
  $('dcancel').textContent = rd ? 'Stop redrawing' : 'Cancel';
  $('dfinish').textContent = rd ? 'Apply' : p.edit ? 'Accept' : 'Finish';
  $('dfinish').disabled = rd ? rd.pts.length < 2 : n < (p.kind === 'extent' ? 3 : 2);
}

/* The glyph each mark is drawn with on the plate, for its row in the list. */
const GLYPH = {
  seed: '<svg class="sw" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="var(--seed)" stroke="#fff" stroke-width="1.4"/></svg>',
  unseed: '<svg class="sw" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M3.5 12.5l9-9" stroke="var(--unseed)" stroke-width="2.4" stroke-linecap="round"/></svg>',
  leader: '<svg class="sw" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1.5" width="7" height="5" fill="none" stroke="var(--box)" stroke-width="1.4"/><path d="M6.5 6l5 5" stroke="var(--seed)" stroke-width="1.6"/><circle cx="11.5" cy="11.5" r="3" fill="var(--seed)" stroke="#fff" stroke-width="1.2"/></svg>',
  boundary: '<svg class="sw" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12.5L6.5 5l3.5 5 4-7" fill="none" stroke="var(--bound)" stroke-width="2.2" stroke-linejoin="round"/></svg>',
  extent: '<svg class="sw" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 5.5l5-3.5 6.5 3-1.5 7.5-7 1.5z" fill="var(--ext)" fill-opacity=".18" stroke="var(--ext)" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  unextent: '<svg class="sw" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 5.5l5-3.5 6.5 3-1.5 7.5-7 1.5z" fill="none" stroke="var(--ext)" stroke-width="1.6" stroke-linejoin="round"/><path d="M2.5 2.5l11 11M2.5 13.5l11-11" stroke="var(--unseed)" stroke-width="1.6"/></svg>',
  note: '<span class="sw" style="background:var(--muted)"></span>',
};

/* A boundary's ends as the pipeline will take them. */
function endsSaid(b, i) {
  if (b.closed) return {text: 'a ring: no ends to bridge', bad: false};
  const bridge = S.d.bridge_px;
  const say = (d) => (d <= 0.5 ? 'on the ink' : isFinite(d)
    ? d.toFixed(0) + ' px off, ' + (d <= bridge ? 'bridged' : 'not bridged') : 'far from the ink');
  const ds = [b.page_px[0], b.page_px[b.page_px.length - 1]].map((q) => gapAt(q, i).d);
  const bad = ds.some((d) => d > bridge);
  return {text: ds[0] <= 0.5 && ds[1] <= 0.5 ? 'both ends on the ink'
    : 'ends: ' + say(ds[0]) + ' · ' + say(ds[1]), bad};
}

function renderMarks() {
  const D = S.draft, el = $('marks');
  el.innerHTML = '';
  const add = (glyph, head, sub, o) => {
    const d = document.createElement('div');
    d.className = 'mark';
    d.innerHTML = glyph + '<span class="txt"><span></span><em></em></span>'
      + (o.edit ? '<button class="ed" type="button" title="Open it, to move its points or redraw a stretch">Edit</button>' : '')
      + '<button class="x" type="button" title="Drop this mark" aria-label="Drop this mark">×</button>';
    const txt = d.querySelector('.txt');
    txt.children[0].textContent = head;
    txt.children[1].textContent = sub.text || sub;
    if (sub.bad) txt.children[1].classList.add('bad');
    d.querySelector('.x').onclick = () => {
      if (S.pending && S.pending.src) cancelPending();
      remember(!o.key);
      o.drop();
      if (o.key) marked();
      renderMarks(); renderOpts(); draw();
    };
    if (o.edit) d.querySelector('.ed').onclick = o.edit;
    if (o.go) { txt.onclick = o.go; txt.style.cursor = 'zoom-in'; }
    if (o.key) {
      d.onmouseenter = () => { S.hi = {key: o.key, i: o.i}; draw(); };
      d.onmouseleave = () => { S.hi = null; draw(); };
    }
    el.appendChild(d);
  };
  const where = (mm) => 'ML ' + fmt(mm[0], 3) + '  DV ' + fmt(mm[1], 3);
  D.seeds.forEach((s, i) => {
    const led = isLead(s);
    const neg = s.kind === 'negative';
    add(led ? GLYPH.leader : neg ? GLYPH.unseed : GLYPH.seed,
      led ? s.abbr + '[' + s.label_index + ']: its line ends here'
        : s.abbr + (neg ? ' is not here' : ' is here'),
      (led ? 'Leader' : neg ? 'Seed −' : 'Seed +') + ' · ' + where(s.mm) + (s.note ? ' — ' + s.note : ''),
      {key: 'seeds', i, drop: () => D.seeds.splice(i, 1), go: () => zoomTo([s.page_px], 200)});
  });
  D.boundaries.forEach((b, i) => add(GLYPH.boundary,
    'Missing ' + (b.style || 'solid') + ' line' + (b.closed ? ', a ring' : ''),
    (() => { const e = endsSaid(b, i); return {text: 'Boundary · ' + b.page_px.length + ' points · ' + e.text
      + (b.note ? ' — ' + b.note : ''), bad: e.bad}; })(),
    {key: 'boundaries', i, drop: () => D.boundaries.splice(i, 1), go: () => zoomTo(b.page_px),
      edit: () => editMark('boundaries', i)}));
  D.extents.forEach((e, i) => {
    const neg = e.kind === 'negative';
    const ring = e.ring === undefined || e.ring === null ? '' : ' (ring ' + (e.ring + 1) + ')';
    add(neg ? GLYPH.unextent : GLYPH.extent,
      neg ? e.abbr + ' has no area here' + ring : 'The outline of ' + e.abbr + ring,
      (neg ? 'Extent −' : 'Extent +') + ' · ' + e.page_px.length + ' vertices' + (e.note ? ' — ' + e.note : ''),
      {key: 'extents', i, drop: () => D.extents.splice(i, 1), go: () => zoomTo(e.page_px),
        edit: () => editMark('extents', i)});
  });
  D.notes.forEach((n, i) => add(GLYPH.note, 'Note', n, {drop: () => D.notes.splice(i, 1)}));
  if (!marksIn(D) && !D.notes.length) {
    const d = document.createElement('div');
    d.className = 'mark empty';
    d.textContent = 'Nothing marked on this plate.';
    el.appendChild(d);
  }
  // marks stay on the plate they were made on, so say where the ones out of sight are
  const away = markedPlates().filter((n) => n !== S.plate);
  if (away.length) {
    const d = document.createElement('div');
    d.className = 'mark empty';
    d.textContent = 'Marks are waiting on plate ' + away.join(', ') + '.';
    el.appendChild(d);
  }
  $('commitb').disabled = !markedPlates().length;
  renderPips();
  sheetLabel();
}

// A mark's Edit: the tool it was drawn with, and the mark open in the editor.
function editMark(key, i) {
  cancelPending();
  const t = key === 'extents' ? 'extent' : 'boundary';
  if (key === 'extents') S.opts.extkind = S.draft.extents[i].kind === 'negative' ? 'negative' : 'positive';
  if (S.tool !== t) setTool(t);
  openEditor(key, i);
  renderOpts();
}

/* The plates that hold marks, under the slider. A draft that is not on the plate in
   front of you is otherwise invisible, and a correction is only ever sent for the
   plate it was drawn on. */
function renderPips() {
  const el = $('pips');
  el.innerHTML = '';
  for (const n of markedPlates()) {
    const i = document.createElement('i');
    i.style.left = ((n - 1) / 61 * 100) + '%';
    el.appendChild(i);
  }
}

/* ------------------------------------------------------------------ actions */

function draftNow() { S.draft.problem = $('problem').value; return S.draft; }

async function inspect(qc) {
  try {
    const r = await SRC.inspect(draftNow(), !!qc);
    report(r.lines.join('\n'));
    if (r.qc) toast('wrote ' + r.qc);
  } catch (e) { report(String(e.message), true); toast(e.message, true); }
}

async function recut() {
  try {
    report('cutting the plate again with the correction applied — about ten seconds…');
    const r = await SRC.recut(draftNow());
    S.cut = r;
    // what the reader saw and accepted travels with the correction, so the session can
    // check its own re-cut against it; a mark added after this drops it (see marked())
    const me = r.regions.find((q) => q.abbr === S.draft.abbr);
    S.draft.preview = {area_mm2_before: me ? me.before : 0, area_mm2: me ? me.after : 0,
      changed: r.changed.slice()};
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

/* A picture of each plate as it stands with its marks, for its file to carry. The plate
   in front of you is the canvas as it is; another has to come up to be drawn, so the
   page walks there and back, which is what you would do to look at it. */
async function snapshots(plates) {
  const out = new Map(), home = S.plate;
  // the picture is of the marks, not of where the pointer happened to be
  const keep = [S.hover, S.snapAt, S.hi];
  S.hover = S.snapAt = S.hi = null;
  for (const n of plates) {
    if (n !== S.plate) { toast('a picture of plate ' + n); await loadPlate(n); }
    draw();
    out.set(n, cv.toDataURL('image/png'));
  }
  if (S.plate !== home) await loadPlate(home);
  else [S.hover, S.snapAt, S.hi] = keep;
  return out;
}

async function commit() {
  const B = batch();
  if (!B.length) { toast('Mark something first', true); return; }
  const plates = [...new Set(B.map((it) => it.plate))];
  let pre;
  try { pre = await Promise.all(B.map((it) => SRC.document(it.draft))); }
  catch (e) { report(String(e.message), true); toast(e.message, true); return; }

  const send = async () => {
    const dry = $('m-dry').checked, snap = $('m-snap').checked;
    // what is wrong on each plate, as it reads on the sheet, back into the drafts. A
    // plate can go without a word: the marks are the correction, and the file carries
    // an empty `problem` where none was written.
    for (const n of plates) {
      const t = $('m-prob-' + n).value.trim();
      const D = S.drafts.get(n);
      if (D) D.problem = t;
      if (n === S.plate) { S.draft.problem = t; $('problem').value = t; }
      for (const it of B) if (it.plate === n) it.draft.problem = t;
    }
    closeSheet();
    try {
      const pngs = snap ? await snapshots(plates) : new Map();
      const r = await SRC.commit(B.map((it) => ({draft: it.draft, png: pngs.get(it.plate) || null})), dry);
      report(r.json);
      const ids = r.ids || [r.id];
      if (r.dry) { toast('wrote ' + (r.paths || [r.path]).join(', ')); return; }
      // sent: nothing waits on those plates now
      for (const n of plates) { S.drafts.delete(n); S.hist.delete(n); }
      if (plates.includes(S.plate)) { S.draft = blankDraft(S.plate); S.draft.abbr = S.abbr; $('problem').value = ''; }
      renderMarks(); draw();
      sheet('Pushed ' + counted(ids.length, 'correction'),
        '<p>The branch is <code>' + esc(r.branch) + '</code>: <code>'
        + ids.map(esc).join('</code>, <code>') + '</code>.</p>'
        + (r.url ? '<p><a href="' + r.url + '" target="_blank" rel="noreferrer">the branch</a>'
          + ' · <a href="' + r.actions + '" target="_blank" rel="noreferrer">the workflow</a></p>' : '')
        + '<p>A session now reads ' + (ids.length === 1 ? 'it' : 'each') + ' with '
        + '<code>tools/corrections.py inspect</code>, fixes the input at fault, rebuilds, and '
        + 'a pull request is opened.</p>', [['Close', closeSheet]]);
    } catch (e) { report(String(e.message), true); toast(e.message, true); }
  };

  const said = (n) => (S.drafts.get(n) || {}).problem || '';
  const list = B.map((it) => '<li>plate ' + it.plate + ', <b>' + esc(it.draft.abbr || '(no region)')
    + '</b>: ' + esc(marksSaid(it.draft)) + '</li>').join('');
  const probs = plates.map((n) => '<label class="prob">what is wrong on plate ' + n + ' (optional)'
    + '<textarea id="m-prob-' + n + '" rows="2" placeholder="a sentence or two, for the session '
    + 'that applies it">' + esc(said(n)) + '</textarea></label>').join('');
  sheet('Send ' + counted(B.length, 'correction') + (plates.length > 1 ? ' on ' + plates.length + ' plates' : ''),
    '<p id="m-what"></p><ul class="files" id="m-list">' + list + '</ul>' + probs
    + '<pre id="mjson"></pre>'
    + '<label class="chk"><input type="checkbox" id="m-snap" checked>'
    + ' commit a picture of each plate as it stands beside its file' + (plates.length > 1
      ? ' (the page walks to each plate for it)' : '') + '</label>'
    + '<label class="chk"><input type="checkbox" id="m-dry">'
    + ' dry run — write ' + (B.length === 1 ? 'it' : 'them') + ' under build/corrections/ and stop</label>',
    [['Cancel', closeSheet], ['Commit and push', send, 'go']]);
  $('mjson').textContent = pre.map((p) => p.text).join('\n');
  const btn = $('mbtns').lastChild;
  const mode = () => {
    const dry = $('m-dry').checked;
    btn.textContent = dry ? (B.length === 1 ? 'Write it' : 'Write them') : 'Commit and push';
    $('m-what').innerHTML = dry
      ? 'A dry run writes the file' + (B.length === 1 ? '' : 's') + ' under <code>build/corrections/</code> and stops, '
        + 'which is the way to look at what would be sent.'
      : 'The file' + (B.length === 1 ? ' goes' : 's go') + ' on a branch <code>'
        + (B.length === 1 ? 'correction/&lt;id&gt;' : 'correction/&lt;stamp&gt;')
        + '</code> cut from <code>origin/main</code>, as one commit, and the push starts '
        + '<code>apply-correction.yml</code>, which applies ' + (B.length === 1 ? 'it' : 'each of them')
        + ' and opens one pull request. Your own checkout is not touched.';
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
        const r = await SRC.save(draftNow(), p);
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
        const r = await SRC.open(p);
        await useDraft(r.draft);
        toast('read ' + p);
      } catch (e) { toast(e.message, true); }
    }, 'go']]);
}

async function useDraft(d) {
  const n = Number(d.plate) || S.plate;
  if (n !== S.plate) await loadPlate(n);
  S.draft = Object.assign(blankDraft(n), d);
  S.draft.plate = n;
  for (const k of ['seeds', 'boundaries', 'extents', 'notes']) S.draft[k] = S.draft[k] || [];
  S.drafts.set(n, S.draft);
  S.hist.delete(n);                     // a draft read in is where Undo starts from
  $('problem').value = S.draft.problem || '';
  if (S.draft.abbr) select(S.draft.abbr);
  renderMarks();
  draw();
}


/* -------------------------------------------------------------------- wiring */

function cancelPending() {
  if (!S.pending) return;
  S.pending = null;
  S.snapAt = null;
  draw();
  hintFor();
}

/* The plate the page is on, in the three places that say so. The bregma comes from
   the boot list rather than the plate being fetched, so the slider reads right under
   the thumb before its plate has landed. */
function syncPlate(n) {
  $('plate').value = n;
  $('rng').value = n;
  const p = S.boot.plates.find((q) => q.plate === n);
  $('rnglab').textContent = n + (p ? '  ·  ' + fmt(p.bregma) + ' mm' : '');
}

let RNGT = 0;
function goPlate(n) {
  n = Math.max(1, Math.min(62, Math.round(Number(n) || 0)));
  syncPlate(n);
  if (n !== S.want) loadPlate(n);
}

function setTool(t) {
  cancelPending();
  S.tool = t;
  S.lead = null; S.hover = null; S.snapAt = null;
  for (const b of $('toolseg').children) b.classList.toggle('on', b.dataset.t === t);
  cv.dataset.cur = 'crosshair';
  renderOpts();
  draw();
}

// The key to the plate, open or shut. It starts shut: at the fitted view the section fills
// the plate to its corners, and an open key would sit on part of it. Open, it stays open.
const KEYKEY = 'atlasfix.key';
function legend(open) {
  $('legend').classList.toggle('shut', !open);
  $('legbar').setAttribute('aria-expanded', String(!!open));
  try { localStorage.setItem(KEYKEY, open ? '1' : '0'); } catch (e) { /* private mode */ }
}

function toggleSnap() {
  S.opts.snap = !S.opts.snap;
  const c = $('o-snap');
  if (c) c.checked = S.opts.snap;
  S.snapAt = null;
  toast(S.opts.snap ? 'Points near the ink snap onto it' : 'Points go where they are put: no snapping');
  draw(); hintFor();
}

function wire() {
  for (const b of $('toolseg').children) b.onclick = () => setTool(b.dataset.t);
  $('find').oninput = renderRegions;
  $('plate').onchange = () => goPlate($('plate').value || S.want);   // cleared: stay put
  $('prev').onclick = () => goPlate(S.want - 1);
  $('next').onclick = () => goPlate(S.want + 1);
  const rng = $('rng');
  // the number and the bregma follow the thumb at once; the plate itself is a fetch of
  // the tracing, the cut and a scan, so it waits for the drag to settle
  rng.oninput = () => {
    syncPlate(Math.round(Number(rng.value)));
    clearTimeout(RNGT);
    RNGT = setTimeout(() => goPlate(rng.value), 110);
  };
  rng.onchange = () => { clearTimeout(RNGT); goPlate(rng.value); };
  if (!SRC.pipeline) offline();
  $('zin').onclick = () => zoomBy(1.5);
  $('zout').onclick = () => zoomBy(1 / 1.5);
  $('zfit').onclick = fit;
  $('dfinish').onclick = finish;
  $('dcancel').onclick = () => {
    if (S.pending && S.pending.redraw) { S.pending.redraw = null; draw(); hintFor(); }
    else cancelPending();
  };
  $('dundo').onclick = undo;
  $('dredraw').onclick = startRedraw;
  $('dflip').onclick = flip;
  $('ddel').onclick = () => { if (S.pending && S.pending.sel >= 0) deleteVertex(S.pending.sel); };
  $('legbar').onclick = () => legend($('legend').classList.contains('shut'));
  $('inspectb').onclick = () => inspect(false);
  $('qcb').onclick = () => inspect(true);
  $('recutb').onclick = recut;
  $('saveb').onclick = save;
  $('openb').onclick = open_;
  $('commitb').onclick = () => commit();
  $('undob').onclick = undo;
  $('clearb').onclick = () => {
    if (!marksIn(S.draft)) return;
    remember();
    S.draft.seeds = []; S.draft.boundaries = []; S.draft.extents = []; marked();
    S.pending = null; renderMarks(); renderOpts(); draw();
    toast('The marks on this plate are cleared: Undo brings them back');
  };
  $('noteb').onclick = () => sheet('A note on this correction',
    '<p>Anything else worth saying to whoever applies it.</p><textarea id="m-note" rows="3"></textarea>',
    [['Cancel', closeSheet], ['Add', () => {
      const t = $('m-note').value.trim(); closeSheet();
      if (t) { remember(true); S.draft.notes.push(t); renderMarks(); }
    }, 'go']]);
  for (const [id, key] of [['v-ink', 'ink'], ['v-ext', 'ext'], ['v-lab', 'lab'],
    ['v-una', 'una'], ['v-cut', 'cut']]) {
    $(id).onchange = () => { S.show[key] = $(id).checked; draw(); };
  }
  $('modal').onclick = (ev) => { if (ev.target === $('modal')) closeSheet(); };
  $('sheetbar').onclick = () => sheet_(!document.body.classList.contains('shut'));
  window.addEventListener('resize', resize);
  // the plate's box changes with more than the window -- the panel shutting on a phone, a
  // bar below it taking another row -- and a canvas whose bitmap is not the size of its box
  // is drawn stretched, under a pointer that is read unstretched
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(document.querySelector('.platebox'));
  document.addEventListener('keydown', key);
}

/* The published page has no pipeline behind it: Pick still answers, because the face
   map it reads was cut by tools/build_facemaps.py and CI holds it to the tracing, but
   Inspect and Recut are build_region_extents itself and there is nothing here to run
   it with. Say so where the buttons are rather than letting them fail. */
function offline() {
  for (const [id, why] of [['inspectb', 'Inspect'], ['recutb', 'Recut'], ['qcb', 'QC image']]) {
    const b = $(id);
    b.disabled = true;
    b.title = why + ' runs build_region_extents, which needs the repository. Run '
      + 'python3 tools/atlasfix.py ' + (S.boot.start.plate || '<plate>') + ' from a clone, '
      + 'or open the repository in a Codespace, and this page gets it back.';
  }
  const box = $('recutb').parentNode;
  const b = document.createElement('button');
  b.className = 'b';
  b.textContent = 'Forget the token';
  b.title = 'Clear the GitHub token this browser is keeping for pushing corrections';
  b.onclick = () => { forgetToken(); toast('the token is forgotten'); };
  box.appendChild(b);
  report('This is the published page, so there is no pipeline behind it.\n\n'
    + 'Pick still answers with the extraction\u2019s own cut: data/facemaps/ is the plate '
    + 'as build_region_extents cut it, rebuilt and checked in CI. Inspect and Recut are '
    + 'that script itself and cannot run here \u2014 the session that applies your '
    + 'correction runs them, and says what it found in the pull request.\n\n'
    + 'Commit writes corrections/<id>.json on a branch through the GitHub API, which '
    + 'needs a fine-grained token with Contents: read and write. To get Recut back, run '
    + 'the tool from a clone or in a Codespace.\n\n'
    + 'Guide, in the header: what a correction corrects, what each tool is for, and what '
    + 'happens after you send it.');
}


/* Undo takes back the last step of whatever is in hand: a point of a shape being drawn or
   of a new line being routed, a move in the editor -- and with nothing in hand, the last
   change to the draft. */
function undo() {
  const p = S.pending;
  if (p && p.redraw) {
    if (p.redraw.pts.length) p.redraw.pts.pop(); else p.redraw = null;
    draw(); hintFor();
    return;
  }
  if (p && p.edit) {
    if (p.hist.length) { p.pts = p.hist.pop(); p.sel = -1; draw(); hintFor(); }
    else toast('Nothing to take back here: Cancel leaves it as it was');
    return;
  }
  if (p) {
    if (p.pts.length > 1) { p.pts.pop(); draw(); hintFor(); } else cancelPending();
    return;
  }
  const h = S.hist.get(S.draft.plate);
  if (!h || !h.length) { toast('Nothing to undo on this plate'); return; }
  const was = h.pop();
  Object.assign(S.draft, JSON.parse(was.marks));
  if (!was.note) marked();              // a note is not a mark: the recut still describes the draft
  S.lead = null;
  renderMarks(); renderOpts(); draw();
}

function flip() {
  const p = S.pending;
  if (!p || !p.redraw) return;
  p.redraw.flip = !p.redraw.flip;
  draw();
}

function key(ev) {
  // a field being typed in keeps its keys; a ticked box or the slider does not need them
  if (ev.target.matches('textarea,select,input:not([type="checkbox"]):not([type="range"])')) {
    if (ev.key === 'Escape') ev.target.blur();
    return;
  }
  const k = ev.key, p = S.pending;
  if (k === 'Escape') {
    if (!$('modal').hidden) closeSheet();
    else if (p && p.redraw) { p.redraw = null; draw(); hintFor(); }
    else if (p) cancelPending();
    else if (S.lead) { S.lead = null; renderOpts(); draw(); }
    return;
  }
  if (!$('modal').hidden) return;
  // the browser's own shortcuts are left alone, but for Undo, which is this page's too
  if (ev.ctrlKey || ev.metaKey) {
    if (k === 'z' || k === 'Z') { ev.preventDefault(); undo(); }
    return;
  }
  if (k === 'Enter') { finish(); return; }
  if (p && p.edit && !p.redraw && p.sel >= 0 && (k === 'Delete' || k === 'Backspace')) {
    ev.preventDefault(); deleteVertex(p.sel); return;
  }
  if (k === 'Backspace') { ev.preventDefault(); undo(); return; }
  if (k === 'Tab' && p && p.redraw) { ev.preventDefault(); flip(); return; }
  const tools = {1: 'pick', 2: 'seed', 3: 'unseed', 4: 'boundary', 5: 'extent', 6: 'leader'};
  if (tools[k]) { setTool(tools[k]); return; }
  if (k === 'f') fit();
  else if (k === 'z') undo();
  else if (k === 'd') startRedraw();
  else if (k === 'g') toggleSnap();
  else if (k === 'k') legend($('legend').classList.contains('shut'));
  else if (k === 'i') inspect(false);
  else if (k === 'r') recut();
  else if (k === 's') save();
  else if (k === 'c') { if (!$('commitb').disabled) commit(); }
  else if (k === ',') goPlate(S.want - 1);
  else if (k === '.') goPlate(S.want + 1);
  else if (k === 'l') {
    const i = S.d.layers.indexOf(S.layer);
    S.layer = S.d.layers[(i + 1) % S.d.layers.length];
    layerSeg(); loadImage();
  }
}

// The panel, shut or open. On a phone it starts shut: the plate is what a small
// screen has room for, and the bar says what it is holding.
function sheet_(shut) {
  document.body.classList.toggle('shut', !!shut);
  $('sheetbar').setAttribute('aria-expanded', String(!shut));
  requestAnimationFrame(resize);
}

(async function start() {
  try {
    S.boot = await pickBackend();
    wire();
    const phone = matchMedia('(max-width: 860px)').matches;
    if (phone) sheet_(true);
    let keyOpen = false;
    try { const v = localStorage.getItem(KEYKEY); if (v !== null) keyOpen = v === '1'; } catch (e) { /* private mode */ }
    legend(keyOpen);
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
