#!/usr/bin/env python3
"""Corrections to the region extraction, read in from the plate view.

The app draws no region by hand. `region_extents` is cut from the tracings in
svg/ and the seeds in label_positions and label_leaders, so a region that comes
out wrong is one of those inputs being wrong, and the fix is to the input and
not to the polygon. What a reader can say from the plate view is where the
region is -- a point inside it -- and where its boundary runs. matlab/
AtlasRegionFix.m writes that down as corrections/<id>.json, in the page frame
the tracings are in, and this reads it back against the extraction.

  inspect FILE [--qc]   Where each seed lands today and in whose face; how far
                        each drawn boundary's ends sit from traced ink, and
                        whether BRIDGE_PX closes the gap; which runs of a
                        corrected extent lie off the ink already traced. --qc
                        draws all of it over the plate: qc/chk_corr_<id>.png.
  apply FILE [--dry-run]
                        Boundaries, and the off-ink runs of an extent, go into
                        the plate's SVG as paths a reader can diff, in the group
                        the style names; positive seeds go into seed_overrides.
                        Nothing is removed: a line the tracing draws and the
                        atlas does not is taken out by hand, with the reason in
                        the commit. Then build_region_extents.py and the rest of
                        the pipeline, in the order tools/README.md gives.

A seed becomes a row of `seed_overrides`: a seed of its own, beside the printed
ones, unless the entry carries `label_index`, in which case it stands in for that
printed box of its name as a leader tip does -- the box's own seed is withdrawn,
which is what a box seeding the wrong face needs (OV on plate 5, #78) and what a
box seeding the right face must not get. A boundary becomes a path of cubics with collinear control
points -- build_region_extents.flatten reads M, C and Z and nothing else, so a
straight run is written as the cubic it is -- carrying `data-correction` with the
id it came from, so the SVG says what a reader added and what the tracer drew.

Reads:  corrections/<id>.json, svg/*.svg, data/gerbil_atlas.json, data/vec.json
Writes: svg/GerbilAtlas_Plate_NN.svg, data/gerbil_atlas.json (`seed_overrides`),
        qc/chk_corr_<id>.png

Usage:  python3 tools/corrections.py validate corrections/*.json
        python3 tools/corrections.py inspect corrections/<id>.json --qc
        python3 tools/corrections.py apply corrections/<id>.json [--dry-run]
"""

import argparse
import json
import math
import os
import re
import sys

import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                              # noqa: E402
import build_region_extents as B                  # noqa: E402
import regiongeom as G                            # noqa: E402
from atlaslib import xf, inv6                     # noqa: E402

SCHEMA = 'gerbil-atlas-correction/1'
CORRDIR = os.path.join(A.ROOT, 'corrections')
OFF_INK_PX = B.SUPPORT_PX   # page px: a boundary further than this from traced ink is not traced
MIN_RUN_PX = 6              # a run off the ink shorter than this is the tracer's own error
DEC = 4                     # override fractions, as label_leaders has them
GROUPS = {'solid': 'outlines-solid', 'dashed': 'outlines-dashed'}
DASH = '12.0 7.0'           # the dasharray a hand-added dashed run is drawn with
FRAME_TOL_MM = 0.02         # page px and mm in one entry must agree to this


# ------------------------------------------------------------- the document

def resolve(name):
    """A path, or the id of a file in corrections/."""
    if os.path.isfile(name):
        return name
    for cand in (os.path.join(CORRDIR, name), os.path.join(CORRDIR, name + '.json')):
        if os.path.isfile(cand):
            return cand
    raise SystemExit('no such correction: %s' % name)


def load(path):
    with open(path, encoding='utf8') as f:
        c = json.load(f)
    if c.get('schema') != SCHEMA:
        raise SystemExit('%s: schema is %r; this reads %r' % (path, c.get('schema'), SCHEMA))
    for k in ('id', 'plate', 'abbr'):
        if not c.get(k):
            raise SystemExit('%s: no %s' % (path, k))
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', str(c['id'])):
        raise SystemExit('%s: id %r is not a file name' % (path, c['id']))
    c['plate'] = int(c['plate'])
    if not 1 <= c['plate'] <= A.N_PLATES:
        raise SystemExit('%s: no plate %d' % (path, c['plate']))
    for k in ('seeds', 'boundaries', 'extents', 'notes'):
        c[k] = c.get(k) or []
    return c


class Plate:
    """One plate's frames and ink: page <-> plate <-> mm, and the traced raster."""

    def __init__(self, DB, VECM, plate):
        self.plate = plate
        self.m = VECM[str(plate)]
        self.im = inv6(self.m)
        self.fr = A.Frame(DB['plate_frame'])
        self.NW, self.NH = DB['plate_frame']['width_px'], DB['plate_frame']['height_px']
        self.svg = os.path.join(A.SVGDIR, 'GerbilAtlas_Plate_%02d.svg' % plate)
        self.W, self.H, self.polys = B.read_svg(self.svg)
        traced = np.zeros((self.H, self.W), bool)
        for pts, _c in self.polys:
            B.rasterize(traced, pts, self.W, self.H)
        self.traced = traced
        self.outline = []
        for poly in DB['brain_outline']['data'][str(plate)]:
            pp = [xf(self.im, x * self.NW, y * self.NH) for x, y in poly]
            pp.append(pp[0])
            self.outline.append(pp)
        allp = [p for pts, _c in self.polys for p in pts] + [p for pp in self.outline for p in pp]
        self.tree = cKDTree(np.asarray(allp, float))
        self._dist = None
        det = abs(self.m[0] * self.m[3] - self.m[1] * self.m[2])
        self.mm2_per_px = det / (self.fr.mlpx * self.fr.dvpx)       # one page pixel, in mm2
        self.mm_per_px = math.sqrt(self.mm2_per_px)

    @property
    def dist(self):
        """Distance from every page pixel to the nearest traced ink."""
        if self._dist is None:
            self._dist = ndimage.distance_transform_edt(~self.traced)
        return self._dist

    def page_to_mm(self, x, y):
        px, py = xf(self.m, x, y)
        return self.fr.ml(px), self.fr.dv(py)

    def mm_to_page(self, ml, dv):
        return xf(self.im, self.fr.x(ml), self.fr.y(dv))

    def page_to_frac(self, x, y):
        px, py = xf(self.m, x, y)
        return px / self.NW, py / self.NH

    def nearest_ink(self, pt):
        """Distance in page px from a point to the traced network, outline included."""
        d, _i = self.tree.query(pt)
        return float(d)

    def off_ink(self, pt):
        xi, yi = int(round(pt[0])), int(round(pt[1]))
        if not (0 <= xi < self.W and 0 <= yi < self.H):
            return True
        return bool(self.dist[yi, xi] > OFF_INK_PX)


def check_frames(c, P):
    """Where an entry carries both page px and mm they must agree, because they
    were written by two transforms in whatever made the file -- MATLAB's, in
    matlab/AtlasRegionFix.m -- and this is the check on them. Page px are what
    is read; mm are for the reader."""
    bad = []

    def chk(what, page, mm):
        ml, dv = P.page_to_mm(float(page[0]), float(page[1]))
        if abs(ml - float(mm[0])) > FRAME_TOL_MM or abs(dv - float(mm[1])) > FRAME_TOL_MM:
            bad.append('%s: page (%.1f, %.1f) is ML %+.3f DV %+.3f; the file says ML %+.3f DV %+.3f'
                       % (what, float(page[0]), float(page[1]), ml, dv, float(mm[0]), float(mm[1])))

    for k, s in enumerate(c['seeds']):
        if s.get('page_px') and s.get('mm'):
            chk('seed %d' % (k + 1), s['page_px'], s['mm'])
    for key in ('boundaries', 'extents'):
        for k, e in enumerate(c[key]):
            if e.get('page_px') and e.get('mm'):
                if len(e['page_px']) != len(e['mm']):
                    bad.append('%s %d: %d page points, %d mm points'
                               % (key[:-1], k + 1, len(e['page_px']), len(e['mm'])))
                    continue
                for j, (pg, mm) in enumerate(zip(e['page_px'], e['mm'])):
                    chk('%s %d point %d' % (key[:-1], k + 1, j + 1), pg, mm)
    if bad:
        raise SystemExit('page px and mm disagree in %s:\n  %s' % (c['id'], '\n  '.join(bad)))


def validate(c, DB, VECM):
    """Everything that can be checked without cutting the plate: the names it
    uses are structures, the frames agree, the geometry is geometry."""
    S = {s['abbr'] for s in DB['structures']}
    names = [c['abbr']] + [s.get('abbr') for s in c['seeds']] + [e.get('abbr') for e in c['extents']]
    for ab in names:
        if ab and ab not in S:
            raise SystemExit('%s: no structure is abbreviated %r' % (c['id'], ab))
        if ab in A.FEATURES:
            raise SystemExit('%s: %s names no region (see `features`)' % (c['id'], ab))
    P = Plate(DB, VECM, c['plate'])
    LP = DB['label_positions']['data'].get(str(c['plate']), {})
    for s in c['seeds']:
        seed_point(s, P)
        if (s.get('kind') or 'positive').lower() not in ('positive', 'negative'):
            raise SystemExit('%s: a seed is %r; positive or negative' % (c['id'], s.get('kind')))
        li = s.get('label_index')
        if li is not None:
            n = len(LP.get(s.get('abbr') or c['abbr'], []))
            if not isinstance(li, int) or not 0 <= li < n:
                raise SystemExit('%s: label_index %r, and %s has %d box%s on plate %d'
                                 % (c['id'], li, s.get('abbr') or c['abbr'], n,
                                    '' if n == 1 else 'es', c['plate']))
    for b in c['boundaries']:
        entry_points(b, P)
    for e in c['extents']:
        if len(entry_points(e, P)) < 3:
            raise SystemExit('%s: an extent needs three points at least' % c['id'])
    check_frames(c, P)
    return P


def seed_point(entry, P):
    """One seed's page point: page_px where it is given, else from mm."""
    if entry.get('page_px'):
        x, y = entry['page_px']
        return float(x), float(y)
    if entry.get('mm'):
        return P.mm_to_page(float(entry['mm'][0]), float(entry['mm'][1]))
    raise SystemExit('a seed needs page_px or mm')


def entry_points(entry, P):
    """A boundary's or extent's page points, likewise."""
    if entry.get('page_px'):
        pts = [(float(x), float(y)) for x, y in entry['page_px']]
    elif entry.get('mm'):
        pts = [P.mm_to_page(float(a), float(b)) for a, b in entry['mm']]
    else:
        raise SystemExit('a boundary or extent needs page_px or mm')
    if len(pts) < 2:
        raise SystemExit('a boundary or extent needs two points at least')
    return pts


def ring_of(entry, P):
    """An extent as a closed ring: first point repeated last, once."""
    pts = entry_points(entry, P)
    if math.dist(pts[0], pts[-1]) > 1e-9:
        pts = pts + [pts[0]]
    return pts


def sample(pts, step=1.0):
    """Points every `step` page px along a polyline, vertices included."""
    out = [pts[0]]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.dist((x0, y0), (x1, y1))
        n = max(1, int(math.ceil(L / step)))
        for k in range(1, n + 1):
            t = k / n
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    return out


def on_ink_share(P, pts):
    """The share of a polyline's length lying within OFF_INK_PX of traced ink."""
    s = sample(pts)
    on = sum(0 if P.off_ink(q) else 1 for q in s)
    return on / len(s)


def off_ink_runs(P, ring):
    """The runs of a closed ring that lie off the ink already traced, each as a
    simplified polyline reaching one sample onto the ink at either end, so the
    pipeline's bridging finds the join. Read circularly, so a run does not break
    at the ring's first vertex."""
    s = sample(ring)[:-1]                       # the ring's closing point repeats the first
    n = len(s)
    off = np.array([P.off_ink(q) for q in s], bool)
    if not off.any():
        return []
    if off.all():
        return [_simplify(s + [s[0]])]
    start = int(np.argmin(off))                 # begin on ink
    order = [(start + k) % n for k in range(n)]
    runs, cur = [], []
    for k in order:
        if off[k]:
            cur.append(k)
        elif cur:
            runs.append(cur)
            cur = []
    if cur:
        runs.append(cur)
    out = []
    for r in runs:
        if len(r) < MIN_RUN_PX:
            continue
        idx = [(r[0] - 1) % n] + r + [(r[-1] + 1) % n]
        out.append(_simplify([s[i] for i in idx]))
    return out


def _simplify(pts, eps=0.5):
    keep = G.dp(pts, eps)
    return [pts[i] for i in keep]


def path_d(pts, closed=False):
    """A polyline as an SVG path of cubics with collinear control points: exact
    straight segments, in the one grammar build_region_extents.flatten reads."""
    def f(v):
        return ('%.2f' % v).rstrip('0').rstrip('.')
    out = ['M %s %s' % (f(pts[0][0]), f(pts[0][1]))]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        out.append('C %s %s %s %s %s %s' % (
            f(x0 + (x1 - x0) / 3), f(y0 + (y1 - y0) / 3),
            f(x0 + 2 * (x1 - x0) / 3), f(y0 + 2 * (y1 - y0) / 3), f(x1), f(y1)))
    if closed:
        out.append('Z')
    return ' '.join(out)


def nearest_box(DB, plate, ab, fx, fy):
    """The index of the printed box of `ab` nearest a plate-frame point, or -1."""
    boxes = DB['label_positions']['data'].get(str(plate), {}).get(ab, [])
    if not boxes:
        return -1, None
    NW, NH = DB['plate_frame']['width_px'], DB['plate_frame']['height_px']
    d = [math.hypot((cx - fx) * NW, (cy - fy) * NH) for cx, cy, _w, _h in boxes]
    i = int(np.argmin(d))
    return i, d[i]


def box_face(DB, P, faces, plate, ab, i):
    """The face box i of `ab` seeds today: from the end of its line where the atlas
    draws one, or a row of seed_overrides stands in, else from the word itself."""
    cx, cy, _w, _h = DB['label_positions']['data'][str(plate)][ab][i]
    at = (cx, cy)
    for j, x, y in DB.get('label_leaders', {}).get('data', {}).get(str(plate), {}).get(ab, []):
        if j == i:
            at = (x, y)
    for row in DB.get('seed_overrides', {}).get('data', {}).get(str(plate), {}).get(ab, []):
        if row[0] == i:
            at = (row[1], row[2])
    px, py = xf(P.im, at[0] * P.NW, at[1] * P.NH)
    xi, yi = int(round(px)), int(round(py))
    if 0 <= xi < faces.shape[1] and 0 <= yi < faces.shape[0]:
        return int(faces[yi, xi])
    return 0


def group_of(style):
    return GROUPS.get((style or 'solid').lower(), GROUPS['solid'])


# ------------------------------------------------------------------ inspect

def inspect(c, DB, VECM, want_qc=False, quiet=False):
    """Read the correction against the extraction as it stands. Returns what it
    found, structured, and prints it unless `quiet`."""
    p, ab = c['plate'], c['abbr']
    S = {s['abbr']: s['name'] for s in DB['structures']}
    P = validate(c, DB, VECM)
    r = B.build_plate(p, DB, VECM, want_qc=True)
    if r is None:
        raise SystemExit('plate %d has no located labels' % p)
    out, _ua, _st, (LBL, interior, _traced, _m, W, H, order, _sup, faces, printed) = r
    byid = {v: k for k, v in order.items()}
    nreg = len(order)
    fsize = np.bincount(faces.ravel())
    bregma = A.bregma_of(DB)[p]
    lines = ['correction %s: plate %d (bregma %+.2f), %s -- %s'
             % (c['id'], p, bregma, ab, S[ab]),
             '  problem: %s' % (c.get('problem') or '(none given)')]
    if ab in out:
        e = out[ab]
        lines.append('  %s today: %.4f mm2 in %d polygon%s, traced share %s%s'
                     % (ab, e['a'], len(e['g']), '' if len(e['g']) == 1 else 's',
                        ', '.join('%.2f' % s for s in e['s']),
                        ' -- no outline of its own (w)' if e.get('w') else ''))
    else:
        lines.append('  %s today: no area on this plate' % ab)
    rep = {'plate': p, 'abbr': ab, 'seeds': [], 'boundaries': [], 'extents': []}

    def owner_at(x, y):
        xi, yi = int(round(x)), int(round(y))
        if not (0 <= xi < W and 0 <= yi < H) or not interior[yi, xi]:
            return None, 0
        lbl = int(LBL[yi, xi])
        fid = int(faces[yi, xi])
        if 1 <= lbl <= nreg:
            return byid[lbl], fid
        if lbl > nreg:
            return '', fid                        # an unnamed face
        return None, fid

    for k, s in enumerate(c['seeds']):
        sab = s.get('abbr') or ab
        if sab not in S:
            raise SystemExit('seed %d names no structure: %r' % (k + 1, sab))
        kind = (s.get('kind') or 'positive').lower()
        x, y = seed_point(s, P)
        ml, dv = P.page_to_mm(x, y)
        fx, fy = P.page_to_frac(x, y)
        owner, fid = owner_at(x, y)
        names = sorted({pr[0] for pr in printed if pr[4] == fid}) if fid else []
        i, dbox = nearest_box(DB, p, sab, fx, fy)
        where = ('outside the section' if owner is None and not fid else
                 'on a traced line' if fid == 0 else
                 'in an unnamed face' if owner == '' else
                 'in no region' if owner is None else
                 'inside %s' % owner)
        verdict = ''
        if kind == 'negative':
            verdict = ('is %s today, and should not be' % sab if owner == sab
                       else 'is not %s today; nothing to move' % sab)
        elif owner == sab:
            verdict = 'already %s here; the seed changes nothing unless a boundary moves' % sab
        elif fid and names and sab not in names and len(names) == 1:
            verdict = ('a seed here would split a face the atlas letters %s alone -- '
                       'look for a boundary the tracing missed instead' % names[0])
        elif fid:
            li = s.get('label_index')
            if li is not None:
                bf = box_face(DB, P, faces, p, sab, li)
                verdict = ('stands in for box %d, which seeds %s today; the box withdraws '
                           'and this face becomes %s'
                           % (li, ('face #%d (lettered %s)' % (bf, ', '.join(sorted(
                               {pr[0] for pr in printed if pr[4] == bf})) or 'nothing'))
                              if bf else 'a line', sab))
            elif i >= 0:
                bf = box_face(DB, P, faces, p, sab, i)
                verdict = ('a seed of its own: this face becomes %s beside what box %d seeds '
                           '(%s, %.0f plate px away)%s'
                           % (sab, i, 'face #%d' % bf if bf else 'a line', dbox,
                              '' if bf == fid else '; if that box is what is wrong, set '
                              'label_index %d and it withdraws' % i))
            else:
                verdict = 'the plate prints no %s box; it seeds as a row of its own' % sab
        rep['seeds'].append(dict(abbr=sab, kind=kind, page_px=(x, y), mm=(ml, dv),
                                 owner=owner, face=fid,
                                 face_px=int(fsize[fid]) if fid else 0, face_names=names,
                                 box=i, box_dist_px=dbox, verdict=verdict))
        lines.append('  seed %d %s %s: page (%.0f, %.0f) = ML %+.2f DV %+.2f, %s%s'
                     % (k + 1, sab, kind, x, y, ml, dv, where,
                        '; face #%d of %d px (%.3f mm2) lettered %s'
                        % (fid, fsize[fid], fsize[fid] * P.mm2_per_px,
                           ', '.join(names) or 'nothing') if fid else ''))
        if verdict:
            lines.append('    -> %s' % verdict)

    for k, b in enumerate(c['boundaries']):
        pts = entry_points(b, P)
        if b.get('closed'):
            pts = pts + [pts[0]]
        L = sum(math.dist(a, q) for a, q in zip(pts, pts[1:]))
        ends = [P.nearest_ink(pts[0]), P.nearest_ink(pts[-1])]
        share = on_ink_share(P, pts)
        ok = [d <= B.BRIDGE_PX for d in ends]
        rep['boundaries'].append(dict(style=group_of(b.get('style')), length_px=L,
                                      end_dist_px=ends, ends_bridge=ok, on_ink=share))
        lines.append('  boundary %d (%s, %d points, %.0f px = %.2f mm): ends %.1f and %.1f px '
                     'from traced ink, %.0f%% of it on ink already'
                     % (k + 1, group_of(b.get('style')), len(pts), L, L * P.mm_per_px,
                        ends[0], ends[1], 100 * share))
        if share > 0.9:
            lines.append('    -> already traced: this adds no boundary')
        elif all(ok):
            lines.append('    -> both ends within BRIDGE_PX (%d): the pipeline seals it' % B.BRIDGE_PX)
        else:
            lines.append('    -> the %s end is beyond BRIDGE_PX (%d): extend it onto the ink, '
                         'or it will not seal' % ('first' if not ok[0] else 'last', B.BRIDGE_PX))

    for k, e in enumerate(c['extents']):
        eab = e.get('abbr') or ab
        if eab not in S:
            raise SystemExit('extent %d names no structure: %r' % (k + 1, eab))
        ring = ring_of(e, P)
        area = abs(A.poly_area(ring[:-1])) * P.mm2_per_px
        mask = np.zeros((H, W), bool)
        B.rasterize(mask, ring, W, H)
        mask = ndimage.binary_fill_holes(mask)
        gid = order.get(eab)
        inside = int(mask.sum())
        held = int((mask & (LBL == gid)).sum()) if gid else 0
        own = int((LBL == gid).sum()) if gid else 0
        runs = off_ink_runs(P, ring)
        names = sorted({pr[0] for pr in printed
                        if 0 <= int(round(pr[1][0] * P.NW)) and
                        _inside(mask, xf(P.im, pr[1][0] * P.NW, pr[1][1] * P.NH), W, H)})
        rep['extents'].append(dict(abbr=eab, area_mm2=area, share_held=held / max(inside, 1),
                                   share_of_region=held / max(own, 1), runs=runs,
                                   names_inside=names))
        lines.append('  extent %d %s: %d points, %.4f mm2; %s holds %.0f%% of it today and '
                     '%.0f%% of %s lies inside it; printed inside it: %s'
                     % (k + 1, eab, len(ring) - 1, area, eab, 100 * held / max(inside, 1),
                        100 * held / max(own, 1), eab, ', '.join(names) or 'nothing'))
        if not runs:
            lines.append('    -> every part of its outline is on traced ink: the boundary is '
                         'drawn, so the seed is what is wrong')
        for j, run in enumerate(runs):
            Lr = sum(math.dist(a, q) for a, q in zip(run, run[1:]))
            a0, a1 = P.page_to_mm(*run[0]), P.page_to_mm(*run[-1])
            lines.append('    -> run %d off the ink: %.0f px (%.2f mm) from ML %+.2f DV %+.2f '
                         'to ML %+.2f DV %+.2f -- a boundary the tracing missed, or one the '
                         'atlas does not draw' % (j + 1, Lr, Lr * P.mm_per_px, *a0, *a1))

    for n in c['notes']:
        lines.append('  note: %s' % n)
    if want_qc:
        path = write_qc(c, P, DB, out, printed)
        lines.append('  wrote %s' % path)
        rep['qc'] = path
    if not quiet:
        print('\n'.join(lines))
    rep['lines'] = lines
    return rep


def _inside(mask, pt, W, H):
    xi, yi = int(round(pt[0])), int(round(pt[1]))
    return 0 <= xi < W and 0 <= yi < H and bool(mask[yi, xi])


def write_qc(c, P, DB, out, printed):
    """The correction over the plate: tracings red, the region as it stands green,
    the printed boxes of its name yellow, seeds blue (a negative one crossed),
    boundaries cyan, extents magenta. Twice the plate's size, for the eye."""
    from PIL import Image, ImageDraw
    S = 2
    p, ab = c['plate'], c['abbr']
    NW, NH = P.NW, P.NH
    img = A.plate_image('drawing', p).convert('RGB').resize((NW * S, NH * S), Image.LANCZOS)
    dr = ImageDraw.Draw(img, 'RGBA')

    def at(pt):
        px, py = xf(P.m, pt[0], pt[1])
        return (px * S, py * S)

    for pts, _c in P.polys:
        if len(pts) >= 2:
            dr.line([at(q) for q in pts], fill=(226, 0, 26, 110), width=1)
    if ab in out:
        for g in out[ab]['g']:
            poly = [(x * NW * S, y * NH * S) for x, y in g]
            dr.polygon(poly, fill=(0, 160, 0, 45), outline=(0, 140, 0, 255), width=2)
    for cx, cy, bw, bh in DB['label_positions']['data'].get(str(p), {}).get(ab, []):
        dr.rectangle([(cx - bw / 2) * NW * S, (cy - bh / 2) * NH * S,
                      (cx + bw / 2) * NW * S, (cy + bh / 2) * NH * S],
                     outline=(230, 190, 0, 255), width=2)
    for e in c['extents']:
        ring = ring_of(e, P)
        dr.polygon([at(q) for q in ring[:-1]], fill=(200, 0, 200, 30),
                   outline=(200, 0, 200, 255), width=2)
    for b in c['boundaries']:
        pts = entry_points(b, P)
        if b.get('closed'):
            pts = pts + [pts[0]]
        dr.line([at(q) for q in pts], fill=(0, 170, 200, 255), width=3)
        for q in (pts[0], pts[-1]):
            x, y = at(q)
            dr.ellipse([x - 4, y - 4, x + 4, y + 4], outline=(0, 170, 200, 255), width=2)
    for s in c['seeds']:
        x, y = at(seed_point(s, P))
        if (s.get('kind') or 'positive').lower() == 'negative':
            dr.line([x - 6, y - 6, x + 6, y + 6], fill=(220, 30, 30, 255), width=3)
            dr.line([x - 6, y + 6, x + 6, y - 6], fill=(220, 30, 30, 255), width=3)
        else:
            dr.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(30, 60, 230, 255),
                       outline=(255, 255, 255, 255), width=2)
    dr.rectangle([0, NH * S - 22, NW * S, NH * S], fill=(255, 255, 255, 200))
    dr.text((8, NH * S - 18), '%s  plate %d  %s: red tracing, green %s today, yellow its boxes, '
            'blue seeds, cyan boundaries, magenta extents' % (c['id'], p, ab, ab), fill=(0, 0, 0))
    os.makedirs(A.QCDIR, exist_ok=True)
    path = os.path.join(A.QCDIR, 'chk_corr_%s.png' % c['id'])
    img.save(path)
    return path


# -------------------------------------------------------------------- apply

def plan(c, DB, VECM):
    """What applying the correction would change: the SVG paths, by group, and
    the override rows. Touches nothing."""
    p, ab, cid = c['plate'], c['abbr'], c['id']
    P = validate(c, DB, VECM)
    paths = []
    for b in c['boundaries']:
        pts = entry_points(b, P)
        paths.append((group_of(b.get('style')), path_d(pts, bool(b.get('closed'))),
                      b.get('note') or 'boundary'))
    for e in c['extents']:
        eab = e.get('abbr') or ab
        for run in off_ink_runs(P, ring_of(e, P)):
            paths.append((GROUPS['solid'], path_d(run), 'extent of %s, off the ink' % eab))
    rows = []
    for s in c['seeds']:
        if (s.get('kind') or 'positive').lower() != 'positive':
            continue
        sab = s.get('abbr') or ab
        x, y = seed_point(s, P)
        fx, fy = P.page_to_frac(x, y)
        li = s.get('label_index')
        i = int(li) if li is not None else -1
        why = (s.get('note') or c.get('problem') or 'placed in the plate view').strip()
        rows.append((sab, [i, round(fx, DEC), round(fy, DEC), cid, why]))
    return P, paths, rows


def insert_in_group(txt, gid, elem):
    m = re.search(r'<g id="%s"[^>]*>' % re.escape(gid), txt)
    if not m:
        raise SystemExit('no <g id="%s"> in the SVG' % gid)
    end = txt.index('</g>', m.end())
    line = txt.rfind('\n', 0, end) + 1            # the </g> line's own start
    return txt[:line] + elem + txt[line:]


def apply(c, DB, VECM, dry=False, quiet=False):
    p, cid = c['plate'], c['id']
    P, paths, rows = plan(c, DB, VECM)
    with open(P.svg, encoding='utf8', newline='') as f:
        txt = f.read()
    have = set(re.findall(r'<path d="([^"]+)"[^>]*data-correction="%s"' % re.escape(cid), txt))
    lines = ['correction %s on plate %d:' % (cid, p)]
    added = 0
    for gid, d, note in paths:
        if d in have:
            lines.append('  %s: already carries this path (%s)' % (gid, note))
            continue
        dash = ' stroke-dasharray="%s"' % DASH if gid == GROUPS['dashed'] else ''
        elem = '    <path d="%s" stroke-width="2.00"%s data-correction="%s"/>\n' % (d, dash, cid)
        txt = insert_in_group(txt, gid, elem)
        have.add(d)
        added += 1
        lines.append('  %s: + %s (%d segments; %s)' % (gid, d[:48] + ('...' if len(d) > 48 else ''),
                                                        d.count(' C '), note))
    block = DB.setdefault('seed_overrides', {'note': '', 'data': {}})
    data = json.loads(json.dumps(block['data']))          # changed on a copy until written
    changed = 0
    for sab, row in rows:
        lst = data.setdefault(str(p), {}).setdefault(sab, [])
        same = [k for k, r in enumerate(lst)
                if (r[0] == row[0] if row[0] >= 0 else
                    (r[0] < 0 and abs(r[1] - row[1]) < 2e-4 and abs(r[2] - row[2]) < 2e-4))]
        if same:
            if lst[same[0]] == row:
                lines.append('  seed_overrides %s/%s: already has %s' % (p, sab, row[:3]))
                continue
            lst[same[0]] = row
        else:
            lst.append(row)
        changed += 1
        lines.append('  seed_overrides %s/%s: %s box %d -> (%.4f, %.4f) "%s"'
                     % (p, sab, 'replaces' if same else 'adds', row[0], row[1], row[2], row[4]))
    data = {k: {a: data[k][a] for a in sorted(data[k])} for k in sorted(data, key=int)}
    if not (added or changed):
        lines.append('  nothing to apply')
    elif dry:
        lines.append('  --dry-run: nothing written')
    else:
        if added:
            tmp = P.svg + '.tmp'
            with open(tmp, 'w', encoding='utf8', newline='') as f:
                f.write(txt)
            os.replace(tmp, P.svg)
            lines.append('  wrote %s' % os.path.relpath(P.svg, A.ROOT))
        if changed:
            block['data'] = data
            A.save_db(DB)
            lines.append('  wrote %s (seed_overrides)' % os.path.relpath(A.JSON, A.ROOT))
        lines.append('  now: python3 tools/build_region_extents.py --plates %d --dry-run --qc, '
                     'then the pipeline in tools/README.md' % p)
    if not quiet:
        print('\n'.join(lines))
    return dict(paths=paths, rows=rows, added=added, changed=changed, lines=lines)


# --------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    i = sub.add_parser('inspect', help='read a correction against the extraction')
    i.add_argument('file', help='corrections/<id>.json, or the id')
    i.add_argument('--qc', action='store_true', help='write qc/chk_corr_<id>.png')
    v = sub.add_parser('validate', help='check one or more corrections without cutting a plate')
    v.add_argument('files', nargs='+', help='corrections/<id>.json, or ids')
    a = sub.add_parser('apply', help='write its boundaries into svg/ and its seeds into seed_overrides')
    a.add_argument('file', help='corrections/<id>.json, or the id')
    a.add_argument('--dry-run', action='store_true', help='report what would change, write nothing')
    args = ap.parse_args()

    DB = A.load_db()
    VECM = A.vec_matrices()
    if args.cmd == 'validate':
        for f in args.files:
            c = load(resolve(f))
            validate(c, DB, VECM)
            print('%s: plate %d, %s: %d seed(s), %d boundary(ies), %d extent(s) -- reads'
                  % (c['id'], c['plate'], c['abbr'], len(c['seeds']), len(c['boundaries']),
                     len(c['extents'])))
        return
    c = load(resolve(args.file))
    if args.cmd == 'inspect':
        inspect(c, DB, VECM, want_qc=args.qc)
    else:
        apply(c, DB, VECM, dry=args.dry_run)


if __name__ == '__main__':
    main()
