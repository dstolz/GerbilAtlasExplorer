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

   The marks are the MATLAB class's marks and no others: a seed for the name a face
   should carry, a run of boundary the tracing missed, the outline a region should
   have. Nothing here edits region_extents; a correction is one edit to a pipeline
   input, and the extents are re-cut from it. */
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
  opts: {style: 'solid', closed: false, replaces: null, hemi: ''},
  show: {ink: true, ext: true, lab: true, una: false, cut: false},
  draft: blankDraft(0),
  drafts: new Map(),                    // plate -> the draft made on it, kept while it is away
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

function toMm(x, y) {                       // page px -> [ML, DV] mm
  const f = S.d.frame, p = xf(S.d.m, x, y);
  return [(p[0] - f.ml0) / f.mlpx, (f.dv0 - p[1]) / f.dvpx];
}
function toPage(ml, dv) {                   // [ML, DV] mm -> page px
  const f = S.d.frame;
  return xf(S.d.im, f.ml0 + ml * f.mlpx, f.dv0 - dv * f.dvpx);
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
  commit: (draft, png, dry) => api('/api/commit', {draft, png, dry}),
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
      frame: {w: NW, h: NH, ml0: pf.ml_zero_px, mlpx: pf.ml_px_per_mm,
        dv0: pf.dv_zero_px, dvpx: pf.dv_px_per_mm},
      mm_per_px: Math.sqrt(mm2), mm2_per_px: mm2,
      bridge_px: 20, min_face_px: 400, support_px: 3,
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
      ink_px: Math.round(Math.sqrt(best) * 10) / 10};
  },

  document: async (draft) => { const doc = buildDoc(draft); return {doc, text: renderDoc(doc)}; },

  inspect: null,
  recut: null,

  async save(draft, name) {
    const doc = buildDoc(draft);
    const blob = new Blob([renderDoc(doc)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (name || doc.id).replace(/^.*[\\/]/, '').replace(/\.json$/, '') + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return {path: a.download};
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

  async commit(draft, png, dry) {
    const doc = buildDoc(draft);
    if (!doc.abbr) throw new Error('name the region first');
    if (!doc.problem) throw new Error('say what is wrong first');
    if (!doc.seeds.length && !doc.boundaries.length && !doc.extents.length) {
      throw new Error('mark something first: a seed, a boundary or an extent');
    }
    if (png) doc.snapshot = 'corrections/' + doc.id + '.png';
    const text = renderDoc(doc);
    if (dry) { await Static.save(draft, doc.id); return {id: doc.id, dry: true, path: doc.id + '.json', json: text}; }

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
    const branch = 'correction/' + doc.id;
    const head = await api_('/git/ref/heads/' + REPO.base);
    await api_('/git/refs', {method: 'POST',
      body: JSON.stringify({ref: 'refs/heads/' + branch, sha: head.object.sha})});
    const put = (path, content) => api_('/contents/' + path, {method: 'PUT',
      body: JSON.stringify({message: 'Correction: ' + doc.abbr + ' on plate ' + doc.plate
        + '\n\n' + doc.problem + '\n\nCorrection-Id: ' + doc.id, content, branch})});
    await put('corrections/' + doc.id + '.json', b64(text));
    if (png) await put('corrections/' + doc.id + '.png', png.replace(/^data:[^,]*,/, ''));
    const url = 'https://github.com/' + REPO.owner + '/' + REPO.repo;
    return {id: doc.id, dry: false, branch, json: text, url: url + '/tree/' + branch,
      actions: url + '/actions/workflows/apply-correction.yml'};
  },
};

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

function buildDoc(draft) {
  const n = Number(draft.plate);
  const ab = (draft.abbr || '').trim();
  const now = new Date();
  const p2 = (v) => String(v).padStart(2, '0');
  const stamp = now.getUTCFullYear() + p2(now.getUTCMonth() + 1) + p2(now.getUTCDate())
    + 'T' + p2(now.getUTCHours()) + p2(now.getUTCMinutes()) + p2(now.getUTCSeconds()) + 'Z';
  const created = now.getUTCFullYear() + '-' + p2(now.getUTCMonth() + 1) + '-' + p2(now.getUTCDate())
    + 'T' + p2(now.getUTCHours()) + ':' + p2(now.getUTCMinutes()) + ':' + p2(now.getUTCSeconds()) + 'Z';
  const pt = (q) => {
    const mm = toMm(q[0], q[1]);
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
    doc.extents.push({abbr: e.abbr || ab, page_px: q.map((z) => z[0]), mm: q.map((z) => z[1]),
      note: (e.note || '').trim()});
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
  S.rot = quarterTurn(d.m, d.page[0], d.page[1]);
  S.show.cut = false; $('v-cut').checked = false; $('v-cut').disabled = true;
  S.draft = S.drafts.get(n) || blankDraft(n);
  if (!S.draft.abbr) S.draft.abbr = S.abbr;
  S.abbr = S.draft.abbr;
  S.opts.replaces = null;                   // a label index is one plate's box, not another's
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
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function draw() {
  if (!S.d) return;
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
  const V = viewM();
  ctx.font = '600 11px ui-sans-serif,system-ui,sans-serif';
  ctx.fillStyle = css('--accent');
  for (const L of S.d.labels) {
    if (L.abbr !== S.abbr) continue;
    // the box's top-left on screen, which on a turned page is not its first corner
    let x = Infinity, y = Infinity;
    for (const q of L.box) {
      const at = xf(V, q[0], q[1]);
      x = Math.min(x, at[0]); y = Math.min(y, at[1]);
    }
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

/* One gesture model for a mouse and for fingers, which is what makes the page work on
   a phone: a tap acts, a drag pans, two fingers pinch, and in the extent editor a drag
   that starts on a vertex moves that vertex instead. A press that never travels further
   than TAP_PX is a tap however it was made, so the same code answers a click and a
   fingertip, and the tool acts on release rather than on press -- which is also what
   lets a drag out of a mis-aimed press be taken back. */
const TAP_PX = 6;
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

cv.addEventListener('pointerdown', (ev) => {
  if (!S.d) return;
  ev.preventDefault();
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
  const p = S.pending;
  if (p && p.edit && ev.button === 0 && !ev.shiftKey) {   // the editor takes the drag
    const page = pageOf(at);
    const i = nearVertex(p.pts, page);
    if (i >= 0 && ev.altKey) { if (p.pts.length > 3) p.pts.splice(i, 1); draw(); return; }
    if (i >= 0) { G = {kind: 'vertex', i}; return; }
    const e = nearEdge(p.pts, page);
    if (e >= 0) { p.pts.splice(e + 1, 0, page); G = {kind: 'vertex', i: e + 1}; draw(); return; }
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
    draw();
    return;
  }
  if (G && G.kind === 'pan' && held) {
    G.travelled = Math.max(G.travelled, Math.hypot(at[0] - G.from[0], at[1] - G.from[1]));
    if (G.travelled > TAP_PX) {
      G.tap = false;
      S.fitted = false;
      setPan(true);
      S.view = {k: G.v0.k, x: G.v0.x + at[0] - G.from[0], y: G.v0.y + at[1] - G.from[1]};
      draw();
      return;
    }
  }
  const page = pageOf(at);
  S.at = page;
  if (G && G.kind === 'vertex') { S.pending.pts[G.i] = page; draw(); return; }
  if (S.pending && S.pending.edit) {
    const i = nearVertex(S.pending.pts, page);
    if (i !== S.pending.hover) { S.pending.hover = i; draw(); }
  }
  readout(page);
  if (S.pending && !S.pending.edit && !PTR.size) draw();     // the line to the pointer
});

function done(ev) {
  const held = PTR.get(ev.pointerId);
  PTR.delete(ev.pointerId);
  if (!G) return;
  if (G.kind === 'pan' && G.tap && held && ev.type === 'pointerup') {
    const at = pageOf(held.at);
    S.at = at;
    readout(at);
    if (S.pending && !S.pending.edit) { S.pending.pts.push(at); draw(); hintFor(); }
    else if (!S.pending) click(at, ev);
  }
  if (PTR.size === 0) { G = null; setPan(false); }
  else if (G.kind === 'pinch' && PTR.size === 1) {     // a finger lifted: carry on panning
    const rest = [...PTR.values()][0];
    G = {kind: 'pan', from: rest.at, v0: Object.assign({}, S.view), travelled: 99, tap: false};
  }
}
cv.addEventListener('pointerup', done);
cv.addEventListener('pointercancel', done);
cv.addEventListener('dblclick', (ev) => { ev.preventDefault(); if (S.pending) finish(); });
cv.addEventListener('contextmenu', (ev) => ev.preventDefault());
cv.addEventListener('wheel', (ev) => {
  if (!S.d) return;
  ev.preventDefault();
  const v = S.view, at = local(ev);
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

function readout(page) {
  const mm = toMm(page[0], page[1]);
  $('at').textContent = 'ML ' + fmt(mm[0]) + '  DV ' + fmt(mm[1]) + ' mm   ·   page '
    + page[0].toFixed(0) + ', ' + page[1].toFixed(0);
  const reg = regionAt(page[0], page[1]);
  $('under').textContent = reg ? reg.abbr + ' — ' + reg.name : '';
}

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

const TOUCH = matchMedia('(pointer: coarse)').matches;
const TAPPED = TOUCH ? 'Tap' : 'Click';
const HINTS = {
  pick: '{T} the plate to read what the extraction has there — the face, what seeds it, and which region holds the point today.',
  seed: '{T} where <b>{a}</b> is. Without a box named above it is a seed of its own; with one, that printed box withdraws and this stands in for it.',
  unseed: '{T} where <b>{a}</b> is <b>not</b>. A negative seed is for the reader, not the pipeline.',
  boundary: '{T} along the run of boundary the tracing missed, then <b>Finish</b>. Put its ends on the traced ink — the pipeline only bridges {b} page px.',
  extent: 'Pull the region’s own ring into shape, or {t} a fresh outline. Drag a vertex, {t} an edge to add one, then <b>Accept</b>.',
};
function hintFor() {
  let t = HINTS[S.tool] || '';
  if (S.pending) {
    t = S.pending.edit
      ? 'Drag the vertices into place; {t} an edge to add one'
        + (TOUCH ? '' : ', alt-click one to delete it') + '. <b>Accept</b> keeps it.'
      : (S.pending.pts.length + ' vertex' + (S.pending.pts.length === 1 ? '' : 'es') + ' so far. '
        + '<b>Finish</b> when the run is drawn.');
  }
  $('hint').innerHTML = t.replace(/\{T\}/g, TAPPED).replace(/\{t\}/g, TAPPED.toLowerCase())
    .replace('{a}', S.abbr || 'the region').replace('{b}', S.d ? S.d.bridge_px : 20);
  drawbar();
  sheetLabel();
}

/* What the sheet bar says while it is all that is up, so a phone can see the state
   it is in without opening the panel. */
function sheetLabel() {
  const D = S.draft;
  const n = D.seeds.length + D.boundaries.length + D.extents.length;
  const tool = {pick: 'Pick', seed: 'Seed +', unseed: 'Seed −', boundary: 'Boundary',
    extent: 'Extent'}[S.tool];
  $('sheetwhat').textContent = (S.abbr || 'no region') + ' · ' + tool
    + (n ? ' · ' + n + ' mark' + (n === 1 ? '' : 's') : '') + ' · the tools';
}

// A shape being drawn says on the plate how to finish it: a phone has no Enter key,
// and a double-tap is not a double-click.
function drawbar() {
  const p = S.pending;
  $('drawbar').hidden = !p;
  if (!p) return;
  const n = p.pts.length;
  $('drawcount').textContent = p.edit ? n + ' vertices'
    : n + (n === 1 ? ' point' : ' points');
  $('dundo').hidden = !!p.edit;
  $('dfinish').textContent = p.edit ? 'Accept' : 'Finish';
  $('dfinish').disabled = n < (p.kind === 'extent' ? 3 : 2);
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
  $('commitb').disabled = !marksIn(D);
  renderPips();
  sheetLabel();
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
  try { pre = await SRC.document(D); }
  catch (e) { report(String(e.message), true); toast(e.message, true); return; }

  const send = async () => {
    const dry = $('m-dry').checked;
    const snap = $('m-snap').checked ? cv.toDataURL('image/png') : null;
    closeSheet();
    try {
      const r = await SRC.commit(D, snap, dry);
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
  $('problem').value = S.draft.problem || '';
  if (S.draft.abbr) select(S.draft.abbr);
  renderMarks();
  draw();
}

/* -------------------------------------------------------------------- wiring */

function cancelPending() {
  if (!S.pending) return;
  S.pending = null;
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
  for (const b of $('toolseg').children) b.classList.toggle('on', b.dataset.t === t);
  renderOpts();
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
  $('dcancel').onclick = cancelPending;
  $('dundo').onclick = undo;
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
  $('sheetbar').onclick = () => sheet_(!document.body.classList.contains('shut'));
  window.addEventListener('resize', resize);
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

function undo() {
  const D = S.draft;
  if (S.pending && S.pending.pts.length > 1 && !S.pending.edit) { S.pending.pts.pop(); draw(); hintFor(); return; }
  if (S.pending) { cancelPending(); return; }
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
  if (k === 'Escape') { if (!$('modal').hidden) closeSheet(); else cancelPending(); return; }
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
    if (matchMedia('(max-width: 860px)').matches) sheet_(true);
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
