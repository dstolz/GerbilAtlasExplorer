#!/usr/bin/env python3
"""Mark what is wrong with a region on one plate, in a browser, and send it.

The alternative to `matlab/AtlasRegionFix.m`: the same plate, the same marks, the
same `corrections/<id>.json` on the same `correction/<id>` branch, with no MATLAB
and no toolbox in it. What is different is where the answers come from. MATLAB has
to re-implement the extraction to say what a mark would do -- its own rasterizer,
its own bridging, its own watershed -- and that copy drifts from the pipeline the
moment a constant moves. This runs *the pipeline*: the face map is cut with
`build_region_extents.rasterize` over `BRIDGE_PX`, and **Recut** applies the draft
with `corrections.apply` and re-cuts the plate with `build_region_extents.build_plate`
against a scratch tree, so what you see before you commit is what the workflow will
build after you do.

The app draws no region by hand. `region_extents` is cut from the tracings in `svg/`
and the printed labels (the seeds), so a region that comes out wrong is one of those
inputs being wrong: a run of boundary the tracing missed, a seed in the wrong face,
an island the section outline lost. What a reader can say from the plate is where the
region is and where its boundary runs; this lets you say it on the plate, in
millimetres, and sends it.

    python3 tools/atlasfix.py 19                    # opens the browser on plate 19
    python3 tools/atlasfix.py 19 --abbr S1DZ        # with a region already chosen
    python3 tools/atlasfix.py --draft FILE          # back to a draft, or any correction
    python3 tools/atlasfix.py 19 --no-browser       # just serve; open the URL yourself

In the page: choose the region, say what is wrong, then drop a **Seed** where the
region is, draw the **Boundary** the tracing missed, or pull its **Extent** into shape.
**Pick** reads what the extraction has under the pointer, **Inspect** reads the whole
draft against it, **Recut** builds the plate again with the draft applied, and
**Commit** writes the file on a branch and pushes it, which starts
`.github/workflows/apply-correction.yml`.

Reads:  data/gerbil_atlas.json, data/vec.json, svg/*.svg, data/plates/*/NN.jpg
Writes: qc/chk_corr_<id>.png, and only when asked for it. Marking, `Inspect` and
        `Recut` change nothing: `Recut` applies the draft to a scratch copy of the
        plate's SVG and a copy of the database in memory. `Commit` builds the file in
        a temporary git worktree cut from origin/main and pushes the branch; its
        *dry run* writes the file under build/corrections/ instead and stops.

Needs `pip install -r tools/requirements.txt`; the page needs no network and no
JavaScript beyond what the browser ships.
"""

import argparse
import base64
import contextlib
import copy
import datetime
import http.server
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import webbrowser

import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                              # noqa: E402
import build_region_extents as B                  # noqa: E402
import corrections as C                           # noqa: E402
from atlaslib import xf                           # noqa: E402

VERSION = '1.0'
TOOL = 'atlasfix %s' % VERSION
SRC = os.path.join(A.ROOT, 'src')
LAYERS = ('drawing', 'nissl', 'myelin', 'mri')
ASSETS = {'/': ('text/html; charset=utf-8', 'fixer.html'),
          '/fixer.css': ('text/css; charset=utf-8', 'fixer.css'),
          '/fixer.js': ('application/javascript; charset=utf-8', 'fixer.js')}


# ------------------------------------------------------------------ the cut
#
# Steps 1 to 4 of build_region_extents.build_plate -- ink, bridged ends, section
# interior, faces -- over the plate's own tracing plus whatever the draft adds.
# Its rasterizer, its k-d bridging, its BRIDGE_PX: not a second implementation but
# the same one, called, so a constant that moves there moves here.

def cut_faces(P, extra=()):
    """(faces, fsize, interior) for a plate, with `extra` polylines as ink too.

    `extra` is [(points, closed), ...] in page px -- the draft's boundaries, which
    `corrections.apply` will write into the SVG, so the cut treats them as drawn.
    """
    W, H = P.W, P.H
    allp = list(P.polys) + [(pp, True) for pp in P.outline]
    allp += [(list(pts), bool(closed)) for pts, closed in extra if len(pts) >= 2]
    wall = np.zeros((H, W), bool)
    for pts, _c in allp:
        B.rasterize(wall, pts, W, H)

    pts_all, tag = [], []
    for i, (pp, _c) in enumerate(allp):
        for xy in pp:
            pts_all.append(xy)
            tag.append(i)
    pts_all = np.asarray(pts_all, float)
    T = np.asarray(tag)
    tree = cKDTree(pts_all)
    for i, (pp, closed) in enumerate(allp):
        if closed:
            continue
        for ep in (pp[0], pp[-1]):
            dd, ii = tree.query(ep, k=min(80, len(pts_all)))
            for d_, i_ in zip(np.atleast_1d(dd), np.atleast_1d(ii)):
                if T[i_] != i:
                    if 0 < d_ <= B.BRIDGE_PX:
                        B.rasterize(wall, [ep, tuple(pts_all[i_])], W, H)
                    break

    sect = np.zeros((H, W), bool)
    for pp in P.outline:
        B.rasterize(sect, pp, W, H)
    interior = ndimage.binary_fill_holes(sect)
    faces, n = ndimage.label(~wall & interior)
    return faces, np.bincount(faces.ravel(), minlength=n + 1), interior


def locate(P, faces, fsize, at):
    """The face a plate-frame fraction seeds, by build_plate's own rule: its own
    pixel's face where that is a real one, else the largest within SNAP_PX."""
    px, py = xf(P.im, at[0] * P.NW, at[1] * P.NH)
    xi, yi = int(round(px)), int(round(py))
    fid = 0
    if 0 <= xi < P.W and 0 <= yi < P.H:
        fid = int(faces[yi, xi])
        if fid == 0 or fsize[fid] < B.MIN_FACE_PX:
            fid = 0
    if not fid:
        k = B.SNAP_PX
        win = faces[max(0, yi - k):yi + k, max(0, xi - k):xi + k]
        v = win[win > 0]
        v = v[fsize[v] >= B.MIN_FACE_PX]
        if v.size:
            fid = int(np.bincount(v).argmax())
    return fid


def label_seeds(P, DB, faces, fsize):
    """Every printed label of the plate as the extraction seeds it: the end of its
    leader line where the atlas draws one, a row of `seed_overrides` where a reader
    has moved it, else the word; and the face that lands in."""
    p = str(P.plate)
    boxes = DB['label_positions']['data'].get(p, {})
    lead = DB.get('label_leaders', {}).get('data', {}).get(p, {})
    over = DB.get('seed_overrides', {}).get('data', {}).get(p, {})
    out = []
    for ab, bs in boxes.items():
        tips = {i: (x, y) for i, x, y in lead.get(ab, [])}
        byhand = set()
        for row in over.get(ab, []):
            if row[0] >= 0:
                tips[row[0]] = (row[1], row[2])
                byhand.add(row[0])
        for j, (cx, cy, bw, bh) in enumerate(bs):
            at = tips.get(j, (cx, cy))
            out.append(dict(abbr=ab, index=j, box=[cx, cy, bw, bh], at=list(at),
                            led=j in tips, byhand=j in byhand,
                            face=locate(P, faces, fsize, at)))
    for ab, rows in over.items():
        for row in rows:
            if row[0] < 0:
                at = (row[1], row[2])
                out.append(dict(abbr=ab, index=-1, box=None, at=list(at), led=True,
                                byhand=True, face=locate(P, faces, fsize, at)))
    return out


# ------------------------------------------------------------------ a session

class Session:
    """One run of the tool: the database, and what has been read per plate."""

    def __init__(self):
        self.DB = A.load_db()
        self.VECM = A.vec_matrices()
        self.names = {s['abbr']: s['name'] for s in self.DB['structures']}
        self.bregma = A.bregma_of(self.DB)
        self.lock = threading.Lock()       # the caches
        self.heavy = threading.Lock()      # one plate cut at a time: recut swaps
        self._plates = {}                  # atlaslib.SVGDIR while it runs
        self._cuts = {}

    # ---- per plate
    def plate(self, n):
        with self.lock:
            if n not in self._plates:
                self._plates[n] = C.Plate(self.DB, self.VECM, n)
            return self._plates[n]

    def cut(self, n, extra=()):
        """The face map, cached on the draft's boundaries, so a probe is instant
        until a boundary is drawn and costs one cut after."""
        key = (n, json.dumps([[np.round(pts, 2).tolist(), bool(c)] for pts, c in extra]))
        with self.lock:
            hit = self._cuts.get(key)
        if hit is None:
            P = self.plate(n)
            faces, fsize, interior = cut_faces(P, extra)
            hit = (faces, fsize, interior, label_seeds(P, self.DB, faces, fsize))
            with self.lock:
                if len(self._cuts) > 6:
                    self._cuts.clear()
                self._cuts[key] = hit
        return hit

    # ---- what the page draws
    def payload(self, n):
        P = self.plate(n)
        DB = self.DB
        p = str(n)
        svg = open(P.svg, encoding='utf8').read()
        paths = []
        for gid, body in re.findall(r'<g id="([^"]+)"[^>]*>(.*?)</g>', svg, re.S):
            style = 'dashed' if 'dashed' in gid else 'solid'
            for elem in re.findall(r'<path\b[^>]*>', body):
                d = re.search(r'\bd="([^"]+)"', elem)
                if not d:
                    continue
                corr = re.search(r'data-correction="([^"]+)"', elem)
                paths.append({'d': d.group(1), 'style': style,
                              'corr': corr.group(1) if corr else None})
        regions = []
        for ab, e in sorted(DB['region_extents']['data'].get(p, {}).items()):
            regions.append({'abbr': ab, 'name': self.names.get(ab, ab), 'area': e['a'],
                            'traced': e.get('s', []), 'n': e.get('n', 0), 'w': bool(e.get('w')),
                            'rings': [[fr_page(P, x, y) for x, y in g] for g in e['g']]})
        unass = [[fr_page(P, x, y) for x, y in g]
                 for g in DB['region_extents']['unassigned'].get(p, [])]
        labels = []
        lead = DB.get('label_leaders', {}).get('data', {}).get(p, {})
        over = DB.get('seed_overrides', {}).get('data', {}).get(p, {})
        for ab, bs in sorted(DB['label_positions']['data'].get(p, {}).items()):
            tips = {i: (x, y) for i, x, y in lead.get(ab, [])}
            hand = {row[0]: (row[1], row[2]) for row in over.get(ab, []) if row[0] >= 0}
            for j, (cx, cy, bw, bh) in enumerate(bs):
                at = hand.get(j) or tips.get(j)
                labels.append({'abbr': ab, 'index': j,
                               'box': [fr_page(P, cx - bw / 2, cy - bh / 2),
                                       fr_page(P, cx + bw / 2, cy - bh / 2),
                                       fr_page(P, cx + bw / 2, cy + bh / 2),
                                       fr_page(P, cx - bw / 2, cy + bh / 2)],
                               'at': fr_page(P, *(at or (cx, cy))),
                               'led': at is not None, 'byhand': j in hand})
        sizes = {k: 1 for k in LAYERS
                 if os.path.isfile(os.path.join(A.PLATES, k, '%02d.jpg' % n))}
        return {'plate': n, 'bregma': self.bregma[n], 'page': [P.W, P.H],
                'm': list(P.m), 'im': list(P.im), 'frame': dict(
                    w=P.NW, h=P.NH, ml0=P.fr.ml0, mlpx=P.fr.mlpx, dv0=P.fr.dv0, dvpx=P.fr.dvpx),
                'mm_per_px': P.mm_per_px, 'mm2_per_px': P.mm2_per_px,
                'bridge_px': B.BRIDGE_PX, 'min_face_px': B.MIN_FACE_PX, 'support_px': B.SUPPORT_PX,
                'paths': paths, 'outline': [[[round(x, 1), round(y, 1)] for x, y in pp]
                                            for pp in P.outline],
                'regions': regions, 'unassigned': unass, 'labels': labels, 'layers': sorted(sizes)}

    # ---- what a point is
    def probe(self, n, at, extra=()):
        P = self.plate(n)
        faces, fsize, _interior, seeds = self.cut(n, extra)
        x, y = float(at[0]), float(at[1])
        xi, yi = int(round(x)), int(round(y))
        fid = int(faces[yi, xi]) if 0 <= xi < P.W and 0 <= yi < P.H else 0
        names = sorted({s['abbr'] for s in seeds if s['face'] == fid}) if fid else []
        fx, fy = P.page_to_frac(x, y)
        ml, dv = P.page_to_mm(x, y)
        return {'page_px': [round(x, 2), round(y, 2)], 'mm': [round(ml, 3), round(dv, 3)],
                'face': fid, 'face_px': int(fsize[fid]) if fid else 0,
                'face_mm2': round(int(fsize[fid]) * P.mm2_per_px, 4) if fid else 0.0,
                'names': names, 'owner': self.owner(n, fx, fy),
                'ink_px': round(P.nearest_ink((x, y)), 1)}

    def owner(self, n, fx, fy):
        """Which region's extent holds a plate-frame fraction today."""
        for ab, e in self.DB['region_extents']['data'].get(str(n), {}).items():
            if sum(A.pip(g, fx, fy) for g in e['g']) % 2:
                return ab
        return None


def fr_page(P, fx, fy):
    """A plate-frame fraction as a page-pixel pair, rounded for the wire."""
    x, y = xf(P.im, fx * P.NW, fy * P.NH)
    return [round(x, 1), round(y, 1)]


# ------------------------------------------------------------- the document

def document(draft, S, when=None, commit=None):
    """A draft from the page as the file it will be written as: schema
    gerbil-atlas-correction/1, page px read and millimetres beside them."""
    n = int(draft['plate'])
    P = S.plate(n)
    ab = (draft.get('abbr') or '').strip()
    stamp = (when or datetime.datetime.now(datetime.timezone.utc)).replace(microsecond=0)

    def pt(q):
        x, y = float(q[0]), float(q[1])
        ml, dv = P.page_to_mm(x, y)
        return [trim(x, 2), trim(y, 2)], [trim(ml, 3), trim(dv, 3)]

    seeds = []
    for s in draft.get('seeds') or []:
        pg, mm = pt(s['page_px'])
        e = {'abbr': s.get('abbr') or ab, 'kind': (s.get('kind') or 'positive').lower(),
             'page_px': pg, 'mm': mm, 'note': (s.get('note') or '').strip()}
        if s.get('label_index') is not None:
            e['label_index'] = int(s['label_index'])
        seeds.append(e)
    out = {'schema': C.SCHEMA,
           'id': '%s-p%02d-%s' % (stamp.strftime('%Y%m%dT%H%M%SZ'), n,
                                  re.sub(r'[^A-Za-z0-9_-]', '_', ab or 'region')),
           'created': stamp.strftime('%Y-%m-%dT%H:%M:%SZ'),
           'author': draft.get('author') or author_name(),
           'plate': n, 'ap_bregma_mm': S.bregma[n], 'abbr': ab,
           'hemisphere': '',
           'problem': (draft.get('problem') or '').strip(),
           'seeds': seeds, 'boundaries': [], 'extents': [],
           'notes': [str(x) for x in (draft.get('notes') or [])],
           'snapshot': draft.get('snapshot'),
           'source': {'commit': commit if commit is not None else head_commit(),
                      'site': 'https://dstolz.github.io/GerbilAtlasExplorer/',
                      'repo': A.ROOT, 'tool': TOOL,
                      'python': sys.version.split()[0]}}
    for b in draft.get('boundaries') or []:
        pgs, mms = zip(*[pt(q) for q in b['page_px']])
        out['boundaries'].append({'style': (b.get('style') or 'solid').lower(),
                                  'closed': bool(b.get('closed')),
                                  'page_px': list(pgs), 'mm': list(mms),
                                  'note': (b.get('note') or '').strip()})
    for e in draft.get('extents') or []:
        pts = list(e['page_px'])
        if len(pts) > 3 and math.dist(pts[0], pts[-1]) < 1e-9:
            pts = pts[:-1]
        pgs, mms = zip(*[pt(q) for q in pts])
        out['extents'].append({'abbr': e.get('abbr') or ab, 'page_px': list(pgs),
                               'mm': list(mms), 'note': (e.get('note') or '').strip()})
    # off the millimetres this made, not the draft's: the page sends page px, and a
    # draft written by hand may carry nothing else
    out['hemisphere'] = draft.get('hemisphere') or hemisphere_of(out)
    return out


def hemisphere_of(draft):
    """Left, right or both, read off what has been marked -- MATLAB's rule."""
    ml = [s['mm'][0] for s in draft.get('seeds') or [] if s.get('mm')]
    for key in ('boundaries', 'extents'):
        for e in draft.get(key) or []:
            if e.get('mm'):
                ml.append(sum(q[0] for q in e['mm']) / len(e['mm']))
    if not ml:
        return ''
    return 'left' if all(v < 0 for v in ml) else 'right' if all(v > 0 for v in ml) else 'both'


def render(doc):
    """The correction as text: one line per point list, so a file diffs by mark."""
    def enc(o, level):
        t = json.dumps(o, indent=1, ensure_ascii=False)
        return t.replace('\n', '\n' + ' ' * level)

    def entry(e, level):
        rows = []
        for k, v in e.items():
            v = A.dumps(v) if k in ('page_px', 'mm') else json.dumps(v, ensure_ascii=False)
            rows.append('%s%s: %s' % (' ' * (level + 1), json.dumps(k), v))
        return '{\n' + ',\n'.join(rows) + '\n' + ' ' * level + '}'

    out, items = ['{'], list(doc.items())
    for i, (k, v) in enumerate(items):
        comma = ',' if i < len(items) - 1 else ''
        if k in ('seeds', 'boundaries', 'extents') and v:
            body = ',\n'.join(' ' * 2 + entry(e, 2) for e in v)
            out.append(' %s: [\n%s\n ]%s' % (json.dumps(k), body, comma))
        else:
            out.append(' %s: %s%s' % (json.dumps(k), enc(v, 1), comma))
    out.append('}')
    text = '\n'.join(out) + '\n'
    json.loads(text)                            # never write something unreadable
    return text


def author_name():
    for k in ('GIT_AUTHOR_NAME', 'USER', 'USERNAME'):
        if os.environ.get(k):
            return os.environ[k]
    out = git('config', 'user.name', check=False).strip()
    return out or 'unknown'


def head_commit():
    return git('rev-parse', '--short', 'HEAD', check=False).strip() or ''


# -------------------------------------------------------- against the pipeline

@contextlib.contextmanager
def scratch(S, plate):
    """A copy of the plate's SVG somewhere else, with `atlaslib.SVGDIR` pointed at
    it and `save_db` stilled, so `corrections.apply` can be run for real -- the same
    code the workflow runs -- against a tree that is thrown away. The database it
    edits is the caller's copy, in memory."""
    d = tempfile.mkdtemp(prefix='atlasfix-')
    name = 'GerbilAtlas_Plate_%02d.svg' % plate
    shutil.copyfile(os.path.join(A.SVGDIR, name), os.path.join(d, name))
    old_dir, old_save = A.SVGDIR, A.save_db
    A.SVGDIR = d
    A.save_db = lambda db, path=None: None
    try:
        yield d
    finally:
        A.SVGDIR, A.save_db = old_dir, old_save
        shutil.rmtree(d, ignore_errors=True)


def recut(S, draft):
    """Apply the draft and cut the plate again: what the pipeline would build.

    `corrections.apply` writes the boundaries into the SVG and the seeds into
    `seed_overrides` exactly as it will on the branch; `build_plate` then cuts the
    plate from those. Nothing in the working tree is touched.
    """
    doc = document(draft, S)
    n = doc['plate']
    DB2 = copy.deepcopy(S.DB)
    with S.heavy, scratch(S, n):
        rep = C.apply(doc, DB2, S.VECM, quiet=True)
        r = B.build_plate(n, DB2, S.VECM)
    if r is None:
        raise Failed('plate %d has no located labels' % n)
    after, unass = r[0], r[1]
    P = S.plate(n)
    before = S.DB['region_extents']['data'].get(str(n), {})
    rows, changed = [], []
    for ab in sorted(set(after) | set(before)):
        a = after.get(ab)
        b = before.get(ab)
        moved = (a is None) != (b is None) or (a and b and (
            abs(a['a'] - b['a']) > 5e-4 or [len(g) for g in a['g']] != [len(g) for g in b['g']]))
        row = {'abbr': ab, 'name': S.names.get(ab, ab),
               'before': round(b['a'], 4) if b else 0.0,
               'after': round(a['a'], 4) if a else 0.0,
               'rings': [[fr_page(P, x, y) for x, y in g] for g in a['g']] if a else [],
               'moved': bool(moved)}
        rows.append(row)
        if moved:
            changed.append(row)
    lines = [ln for ln in rep['lines']
             if not ln.startswith('  wrote ') and not ln.startswith('  now: ')]
    lines.append('recut plate %d: %d region%s, %d changed' %
                 (n, len(after), '' if len(after) == 1 else 's', len(changed)))
    for row in changed:
        lines.append('  %-8s %.4f -> %.4f mm2%s' % (row['abbr'], row['before'], row['after'],
                                                    '  (new)' if not row['before'] else
                                                    '  (gone)' if not row['after'] else ''))
    if not changed:
        lines.append('  nothing moved: the marks change no region on this plate')
    return {'regions': rows, 'changed': [r['abbr'] for r in changed], 'lines': lines,
            'unassigned': [[fr_page(P, x, y) for x, y in g] for g in unass]}


class Failed(Exception):
    """Something the reader should be told, not a traceback."""


@contextlib.contextmanager
def as_failure():
    """corrections.py says no by raising SystemExit; the page wants the sentence."""
    try:
        yield
    except SystemExit as e:
        raise Failed(str(e))


# ------------------------------------------------------------------ the branch

def git(*args, cwd=None, check=True):
    r = subprocess.run(('git', '-C', cwd or A.ROOT) + args, capture_output=True, text=True)
    if check and r.returncode:
        raise Failed('git %s failed: %s' % (' '.join(args), (r.stderr or r.stdout).strip()))
    return r.stdout


def commit(S, draft, png=None, dry=False, remote='origin', base='main'):
    """The correction on a branch of its own, pushed.

    Through a temporary worktree cut from `origin/main`, so the checkout you are
    reading the plate from is untouched and the branch carries one commit. The push
    starts `.github/workflows/apply-correction.yml`.
    """
    doc = document(draft, S)
    if not doc['abbr']:
        raise Failed('name the region first')
    if not doc['problem']:
        raise Failed('say what is wrong first')
    if not (doc['seeds'] or doc['boundaries'] or doc['extents']):
        raise Failed('mark something first: a seed, a boundary or an extent')
    with as_failure():
        C.validate(doc, S.DB, S.VECM)
    cid = doc['id']
    if png:
        doc['snapshot'] = 'corrections/%s.png' % cid
    text = render(doc)
    if dry:
        out = os.path.join(A.ROOT, 'build', 'corrections')
        os.makedirs(out, exist_ok=True)
        write(os.path.join(out, cid + '.json'), text)
        if png:
            open(os.path.join(out, cid + '.png'), 'wb').write(png)
        return {'id': cid, 'dry': True, 'path': os.path.relpath(
            os.path.join(out, cid + '.json'), A.ROOT), 'json': text}

    branch = 'correction/%s' % cid
    git('fetch', remote, base)
    wt = os.path.join(tempfile.gettempdir(), 'atlasfix-' + cid)
    git('worktree', 'add', '-b', branch, wt, '%s/%s' % (remote, base))
    try:
        os.makedirs(os.path.join(wt, 'corrections'), exist_ok=True)
        files = ['corrections/%s.json' % cid]
        write(os.path.join(wt, files[0]), text)
        if png:
            files.append('corrections/%s.png' % cid)
            open(os.path.join(wt, files[1]), 'wb').write(png)
        git('add', *files, cwd=wt)
        msg = os.path.join(wt, '.correction-message')
        write(msg, 'Correction: %s on plate %d\n\n%s\n\nCorrection-Id: %s\n'
              % (doc['abbr'], doc['plate'], doc['problem'], cid))
        git('commit', '-q', '-F', msg, cwd=wt)
        os.remove(msg)
        git('push', '-u', remote, branch, cwd=wt)
    finally:
        git('worktree', 'remove', '--force', wt, check=False)
        git('worktree', 'prune', check=False)
        git('branch', '-D', branch, check=False)
    url = remote_url(remote)
    return {'id': cid, 'dry': False, 'branch': branch, 'json': text,
            'url': '%s/tree/%s' % (url, branch) if url else None,
            'actions': '%s/actions/workflows/apply-correction.yml' % url if url else None}


def remote_url(remote='origin'):
    u = git('remote', 'get-url', remote, check=False).strip()
    if not u:
        return None
    u = re.sub(r'^git@([^:]+):', r'https://\1/', u)
    return re.sub(r'\.git$', '', u)


def trim(v, n):
    """A rounded number, whole where it is whole: 1079 rather than 1079.0."""
    v = round(float(v), n)
    return int(v) if v == int(v) else v


def write(path, text):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf8', newline='') as f:
        f.write(text)
    os.replace(tmp, path)


# --------------------------------------------------------------------- serving

class Handler(http.server.BaseHTTPRequestHandler):
    server_version = 'atlasfix/' + VERSION
    session = None
    boot = {}

    def log_message(self, fmt, *args):
        if self.server.verbose:
            sys.stderr.write('  %s\n' % (fmt % args))

    def local(self):
        """The page this serves is the only one allowed to ask. A JSON POST from
        another origin is preflighted and the preflight is not answered, so the
        browser stops it; this is the belt to that brace, and costs a header read."""
        origin = self.headers.get('Origin')
        if origin and origin != 'http://%s' % self.headers.get('Host'):
            self.fail('this answers its own page only', 403)
            return False
        return True

    # ---- plumbing
    def send(self, code, ctype, body, cache=False):
        if isinstance(body, str):
            body = body.encode('utf8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'max-age=3600' if cache else 'no-store')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def json(self, obj, code=200):
        self.send(code, 'application/json', A.dumps(obj))

    def fail(self, msg, code=400):
        self.json({'error': str(msg)}, code)

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'{}')

    # ---- routes
    def do_GET(self):
        path = self.path.split('?')[0]
        if not self.local():
            return
        try:
            if path in ASSETS:
                ctype, name = ASSETS[path]
                with open(os.path.join(SRC, name), encoding='utf8') as f:
                    return self.send(200, ctype, f.read())
            if path == '/api/boot':
                return self.json(self.boot)
            m = re.fullmatch(r'/api/plate/(\d+)', path)
            if m:
                return self.json(self.session.payload(self.plate_of(m.group(1))))
            m = re.fullmatch(r'/api/image/(%s)/(\d+)\.jpg' % '|'.join(LAYERS), path)
            if m:
                n = self.plate_of(m.group(2))
                f = os.path.join(A.PLATES, m.group(1), '%02d.jpg' % n)
                if not os.path.isfile(f):
                    return self.fail('no %s plate %d' % (m.group(1), n), 404)
                with open(f, 'rb') as fh:
                    return self.send(200, 'image/jpeg', fh.read(), cache=True)
            self.fail('no such thing here', 404)
        except Failed as e:
            self.fail(e)
        except Exception as e:                  # a bug is worth seeing in the page
            self.fail('%s: %s' % (type(e).__name__, e), 500)

    def do_POST(self):
        path = self.path.split('?')[0]
        if not self.local():
            return
        try:
            b = self.body()
            if path == '/api/probe':
                n = self.plate_of(b.get('plate'))
                return self.json(self.session.probe(n, b['at'], boundaries_of(b.get('draft'))))
            if path == '/api/document':
                with as_failure():
                    doc = document(b['draft'], self.session)
                    C.validate(doc, self.session.DB, self.session.VECM)
                return self.json({'doc': doc, 'text': render(doc)})
            if path == '/api/inspect':
                with as_failure(), self.session.heavy:
                    doc = document(b['draft'], self.session)
                    rep = C.inspect(doc, self.session.DB, self.session.VECM,
                                    want_qc=bool(b.get('qc')), quiet=True)
                return self.json({'lines': rep['lines'], 'seeds': rep['seeds'],
                                  'boundaries': rep['boundaries'], 'extents': rep['extents'],
                                  'qc': rep.get('qc')})
            if path == '/api/recut':
                with as_failure():
                    return self.json(recut(self.session, b['draft']))
            if path == '/api/save':
                doc = document(b['draft'], self.session)
                p = os.path.abspath(b.get('path') or os.path.join(A.ROOT, 'build', 'drafts',
                                                                  doc['id'] + '.json'))
                os.makedirs(os.path.dirname(p), exist_ok=True)
                write(p, render(doc))
                return self.json({'path': os.path.relpath(p, A.ROOT), 'id': doc['id']})
            if path == '/api/open':
                p = os.path.abspath(b['path'])
                with open(p, encoding='utf8') as f:
                    return self.json({'draft': draft_of(json.load(f)), 'path': p})
            if path == '/api/commit':
                png = base64_png(b.get('png'))
                with as_failure():
                    return self.json(commit(self.session, b['draft'], png=png,
                                            dry=bool(b.get('dry'))))
            self.fail('no such thing here', 404)
        except Failed as e:
            self.fail(e)
        except Exception as e:
            self.fail('%s: %s' % (type(e).__name__, e), 500)

    def plate_of(self, v):
        n = int(v)
        if not 1 <= n <= A.N_PLATES:
            raise Failed('no plate %s' % v)
        return n


def boundaries_of(draft):
    """A draft's boundaries as the cut wants them: (points, closed)."""
    if not draft:
        return ()
    return tuple(([(float(x), float(y)) for x, y in b['page_px']], bool(b.get('closed')))
                 for b in draft.get('boundaries') or [] if len(b.get('page_px') or []) >= 2)


def draft_of(doc):
    """A correction file, or a draft saved from the page, back into a draft."""
    keep = ('plate', 'abbr', 'problem', 'hemisphere', 'seeds', 'boundaries', 'extents',
            'notes', 'author')
    return {k: doc.get(k) for k in keep if doc.get(k) is not None}


def base64_png(s):
    if not s:
        return None
    return base64.b64decode(re.sub(r'^data:image/\w+;base64,', '', s))


def serve(session, host, port, boot, verbose=False):
    Handler.session = session
    Handler.boot = boot
    srv = http.server.ThreadingHTTPServer((host, port), Handler)
    srv.verbose = verbose
    srv.daemon_threads = True
    return srv


# ------------------------------------------------------------------------ main

def main(argv=None):
    # the epilog is the two paragraphs of the docstring that are about using it,
    # from the first command line to the end
    epilog = __doc__[__doc__.index('    python3 tools/atlasfix.py 19'):
                     __doc__.index('Reads:')].rstrip()
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter,
                                 epilog=epilog)
    ap.add_argument('plate', nargs='?', type=int, help='1 to %d' % A.N_PLATES)
    ap.add_argument('--abbr', default='', help='the region the correction is about')
    ap.add_argument('--draft', help='a draft, or any corrections/<id>.json, to come back to')
    ap.add_argument('--layer', default='drawing', choices=LAYERS, help='the plate under the marks')
    ap.add_argument('--port', type=int, default=8770, help='default 8770; 0 picks a free one')
    ap.add_argument('--host', default='127.0.0.1', help='default 127.0.0.1, which is the point')
    ap.add_argument('--no-browser', action='store_true', help='do not open a browser')
    ap.add_argument('--verbose', action='store_true', help='log every request')
    args = ap.parse_args(argv)

    draft = None
    if args.draft:
        with open(args.draft, encoding='utf8') as f:
            draft = draft_of(json.load(f))
    plate = args.plate or (draft or {}).get('plate')
    if plate is None:
        ap.error('name a plate (1-%d), or a draft with --draft' % A.N_PLATES)
    plate = int(plate)
    if not 1 <= plate <= A.N_PLATES:
        ap.error('no plate %d' % plate)

    S = Session()
    abbr = args.abbr or (draft or {}).get('abbr') or ''
    if abbr and abbr not in S.names:
        near = [a for a in S.names if abbr.lower() in a.lower()][:8]
        ap.error('no structure is abbreviated %s%s'
                 % (abbr, ' -- did you mean %s?' % ', '.join(near) if near else ''))
    boot = {'tool': TOOL, 'plates': [{'plate': p['plate'], 'bregma': p['bregma']}
                                     for p in S.DB['plates']],
            'structures': [{'abbr': a, 'name': n} for a, n in sorted(S.names.items())],
            'features': sorted(A.FEATURES), 'layers': list(LAYERS),
            'start': {'plate': plate, 'abbr': abbr, 'layer': args.layer, 'draft': draft},
            'repo': A.ROOT, 'remote': remote_url(), 'commit': head_commit()}

    srv = serve(S, args.host, args.port, boot, verbose=args.verbose)
    url = 'http://%s:%d/' % (args.host, srv.server_address[1])
    print('%s  plate %d%s  %s' % (TOOL, plate, ', %s' % abbr if abbr else '', url))
    print('  the repository:  %s%s' % (A.ROOT, '  (%s)' % boot['commit'] if boot['commit'] else ''))
    print('  ctrl-c to stop')
    if not args.no_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nstopped')
    finally:
        srv.server_close()


if __name__ == '__main__':
    main()
