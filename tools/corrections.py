#!/usr/bin/env python3
"""Corrections to the region extraction, read in from the plate view.

The app draws no region by hand. `region_extents` is cut from the tracings in
svg/ and the seeds in label_positions and label_leaders, so a region that comes
out wrong is one of those inputs being wrong, and the fix is to the input and
not to the polygon. What a reader can say from the plate view is where the
region is -- a point inside it -- and where its boundary runs. matlab/
AtlasRegionFix.m writes that down as corrections/<id>.json, in the page frame
the tracings are in, and this reads it back against the extraction.

  inspect FILE [--qc] [--before REF]
                        Where each seed lands today and in whose face; how far
                        each drawn boundary's ends sit from traced ink, and
                        whether BRIDGE_PX closes the gap; which runs of a
                        corrected extent lie off the ink already traced. --qc
                        draws all of it over the plate, qc/chk_corr_<id>.png,
                        and draws the site cropped and side by side as
                        qc/chk_corr_<id>_site.png: the region as it stands on
                        REF (origin/main) beside the region as it stands here,
                        which after a fix is the picture of what the fix did.
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
        qc/chk_corr_<id>.png, qc/chk_corr_<id>_site.png

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

def inspect(c, DB, VECM, want_qc=False, quiet=False, before='origin/main'):
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
        was = region_on(before, p, VECM) if before else None
        site = write_site(c, P, DB, out, was, before)
        if site:
            lines.append('  wrote %s%s' % (site, '' if was else
                         ' -- the one panel: %s is not a ref this checkout can read' % before))
            rep['site'] = site
    if not quiet:
        print('\n'.join(lines))
    rep['lines'] = lines
    return rep


def _inside(mask, pt, W, H):
    xi, yi = int(round(pt[0])), int(round(pt[1]))
    return 0 <= xi < W and 0 <= yi < H and bool(mask[yi, xi])


def region_on(ref, plate, VECM):
    """The plate cut from the inputs as they stand on git ref `ref` -- the database and
    this plate's tracing, read out of the object store into a directory of their own --
    for a picture of what a fix changed. None where the ref cannot be read: no git, no
    such ref, a checkout that is not a repository."""
    import io
    import subprocess
    import tarfile
    import tempfile
    rel_db = os.path.relpath(A.JSON, A.ROOT)
    rel_svg = os.path.relpath(os.path.join(A.SVGDIR, 'GerbilAtlas_Plate_%02d.svg' % plate), A.ROOT)
    try:
        blob = subprocess.run(['git', 'archive', ref, '--', rel_db, rel_svg], cwd=A.ROOT,
                              capture_output=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return None
    tmp = tempfile.mkdtemp(prefix='corr_before_')
    with tarfile.open(fileobj=io.BytesIO(blob)) as tar:
        try:
            tar.extractall(tmp, filter='data')
        except TypeError:                             # a Python without the filter
            tar.extractall(tmp)
    svgdir = A.SVGDIR
    A.SVGDIR = os.path.join(tmp, os.path.relpath(A.SVGDIR, A.ROOT))   # what build_plate reads
    try:
        DB0 = A.load_db(os.path.join(tmp, rel_db))
        r = B.build_plate(plate, DB0, VECM, want_qc=True)
    finally:
        A.SVGDIR = svgdir
    return (r[0], DB0) if r else None


def _draw_marks(dr, c, P, DB, out, S, at):
    """The correction over one plate image: tracings red, the region as `out` has it
    green, the printed boxes of its name yellow, seeds blue (a negative one crossed),
    boundaries cyan, extents magenta. `at` maps a page point onto the image."""
    p, ab = c['plate'], c['abbr']
    NW, NH = P.NW, P.NH
    for pts, _c in P.polys:
        if len(pts) >= 2:
            dr.line([at(q) for q in pts], fill=(226, 0, 26, 110), width=1)
    if out and ab in out:
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

    _draw_marks(dr, c, P, DB, out, S, at)
    dr.rectangle([0, NH * S - 22, NW * S, NH * S], fill=(255, 255, 255, 200))
    dr.text((8, NH * S - 18), '%s  plate %d  %s: red tracing, green %s today, yellow its boxes, '
            'blue seeds, cyan boundaries, magenta extents' % (c['id'], p, ab, ab), fill=(0, 0, 0))
    os.makedirs(A.QCDIR, exist_ok=True)
    path = os.path.join(A.QCDIR, 'chk_corr_%s.png' % c['id'])
    img.save(path)
    return path


SITE_PANEL_PX = 720          # each panel of the site picture, wide
SITE_MIN_PX = 260            # the window is at least this many page px across


def write_site(c, P, DB, out, before, ref):
    """The site of the correction, cropped, and side by side: the region as it stood on
    `ref` and as it stands now, the reader's marks over both. `before` is what
    region_on returned, or None, in which case the picture is the one panel. The
    window is drawn round everything the picture is about -- the region either side,
    the seeds, boundaries, extents and the boxes of its name -- with a quarter of its
    own size around it and never under SITE_MIN_PX across, so the neighbours read."""
    from PIL import Image, ImageDraw, ImageFont
    S = 2
    p, ab = c['plate'], c['abbr']
    NW, NH = P.NW, P.NH
    base = A.plate_image('drawing', p).convert('RGB').resize((NW * S, NH * S), Image.LANCZOS)

    def at(pt):
        px, py = xf(P.m, pt[0], pt[1])
        return (px * S, py * S)

    # The window is drawn round the reader's marks, and round the polygons and boxes of
    # the region that lie near them: a name the atlas prints on both hemispheres has a box
    # and an area on the far side too, and a window that took those in would be the whole
    # plate. A correction with no marks (extents only, say) takes everything of the name.
    marks = [at(seed_point(s, P)) for s in c['seeds']]
    for b in c['boundaries']:
        marks += [at(q) for q in entry_points(b, P)]
    for e in c['extents']:
        marks += [at(q) for q in ring_of(e, P)]
    groups = []
    for o in ((before[0] if before else None), out):
        if o and ab in o:
            groups += [[(x * NW * S, y * NH * S) for x, y in g] for g in o[ab]['g']]
    for cx, cy, bw, bh in DB['label_positions']['data'].get(str(p), {}).get(ab, []):
        groups.append([((cx - bw / 2) * NW * S, (cy - bh / 2) * NH * S),
                       ((cx + bw / 2) * NW * S, (cy + bh / 2) * NH * S)])

    def bbox(q):
        xs, ys = zip(*q)
        return min(xs), min(ys), max(xs), max(ys)

    pts = list(marks)
    if marks:
        x0, y0, x1, y1 = bbox(marks)
        reach = max(0.25 * max(x1 - x0, y1 - y0), SITE_MIN_PX * S / 2)
        for g in groups:
            gx0, gy0, gx1, gy1 = bbox(g)
            if gx1 >= x0 - reach and gx0 <= x1 + reach and gy1 >= y0 - reach and gy0 <= y1 + reach:
                pts += g
    else:
        for g in groups:
            pts += g
    if not pts:
        return None
    xs, ys = zip(*pts)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    side = max(x1 - x0, y1 - y0, SITE_MIN_PX * S)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = side / 2 * 1.25
    # a 4:3 window, clamped to the plate
    wx, wy = max(half, half * 4 / 3), max(half, half * 3 / 4)
    win = (int(max(0, cx - wx)), int(max(0, cy - wy)),
           int(min(NW * S, cx + wx)), int(min(NH * S, cy + wy)))

    panels = []
    for o, DBo, title in ((before[0], before[1], 'before -- %s' % ref) if before else (None, None, None),
                          (out, DB, 'after -- the branch')):
        if title is None:
            continue
        img = base.copy()
        dr = ImageDraw.Draw(img, 'RGBA')
        _draw_marks(dr, c, P, DBo, o, S, at)
        crop = img.crop(win)
        scale = SITE_PANEL_PX / crop.width
        crop = crop.resize((SITE_PANEL_PX, max(1, int(round(crop.height * scale)))), Image.LANCZOS)
        a = o[ab]['a'] if o and ab in o else 0.0
        panels.append((crop, '%s: %s %.4f mm2' % (title, ab, a)))

    try:
        font = ImageFont.load_default(size=16)
    except TypeError:                                 # an older Pillow: the bitmap font
        font = ImageFont.load_default()
    gap, cap, foot = 12, 26, 22
    W = sum(im.width for im, _ in panels) + gap * (len(panels) - 1)
    H = cap + max(im.height for im, _ in panels) + foot
    sheet = Image.new('RGB', (W, H), (255, 255, 255))
    dr = ImageDraw.Draw(sheet)
    x = 0
    for im, title in panels:
        dr.text((x + 6, 5), title, fill=(0, 0, 0), font=font)
        sheet.paste(im, (x, cap))
        x += im.width + gap
    dr.text((6, H - foot + 3), '%s  plate %d: red tracing, green %s, yellow its boxes, blue seeds '
            '(a negative one crossed), cyan boundaries, magenta extents' % (c['id'], p, ab),
            fill=(0, 0, 0), font=font)
    os.makedirs(A.QCDIR, exist_ok=True)
    path = os.path.join(A.QCDIR, 'chk_corr_%s_site.png' % c['id'])
    sheet.save(path)
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


# --------------------------------------------------------------------- report

def git_out(*args, check=True, binary=False):
    """stdout of a git command run at the repository root; '' (or b'') on failure
    unless `check`."""
    import subprocess
    r = subprocess.run(['git'] + list(args), cwd=A.ROOT, capture_output=True,
                       text=not binary)
    if r.returncode and check:
        raise SystemExit('git %s: %s' % (' '.join(args), (r.stderr or b'').strip()
                                          if binary else r.stderr.strip()))
    return r.stdout if not r.returncode else (b'' if binary else '')


def json_at(ref, rel):
    """A JSON file as it stands on git ref `ref`; None where the ref or the file cannot
    be read."""
    txt = git_out('show', '%s:%s' % (ref, rel), check=False)
    return json.loads(txt) if txt else None


def db_at(ref):
    return json_at(ref, os.path.relpath(A.JSON, A.ROOT).replace(os.sep, '/'))


def volumes_at(ref):
    return json_at(ref, os.path.relpath(A.VOLUMES, A.ROOT).replace(os.sep, '/'))


MOVED_MM2 = 5e-5        # areas are kept to four decimals, so any change of the number counts


def moved(e0, e1):
    """Whether a region_extents entry changed: it arrived or went, the area the atlas
    reports for it changed, or its rings did."""
    if (e0 is None) != (e1 is None):
        return True
    if e0 is None:
        return False
    return abs(e0['a'] - e1['a']) > MOVED_MM2 or [len(g) for g in e0['g']] != [len(g) for g in e1['g']]


def entries_diff(DB0, DB1):
    """Every (plate, abbr) whose entry moved between two databases, as
    {(plate, abbr): (before, after)}, either side None where the entry is absent."""
    R0 = DB0['region_extents']['data'] if DB0 else {}
    R1 = DB1['region_extents']['data'] if DB1 else {}
    out = {}
    for p in sorted(set(R0) | set(R1), key=int):
        a, b = R0.get(p, {}), R1.get(p, {})
        for ab in sorted(set(a) | set(b)):
            if moved(a.get(ab), b.get(ab)):
                out[(int(p), ab)] = (a.get(ab), b.get(ab))
    return out


def hemispheres(entry, fr):
    """(left mm2, right mm2) of an entry: each polygon's share of the area, by the side
    of ML 0 its centroid falls on."""
    if not entry:
        return 0.0, 0.0
    shares = []
    for g in entry['g']:
        a = abs(A.poly_area(g))
        cx = sum(x for x, _y in g) / len(g)
        shares.append((a, fr.ml_f(cx)))
    tot = sum(a for a, _m in shares) or 1.0
    left = entry['a'] * sum(a for a, m in shares if m < 0) / tot
    return round(left, 4), round(entry['a'] - left, 4)


def series(DB, ab):
    """(plates with an entry, area summed over them) for one abbreviation."""
    R = DB['region_extents']['data']
    ps = [int(p) for p in R if ab in R[p]]
    return sorted(ps), round(sum(R[str(p)][ab]['a'] for p in ps), 3)


def input_delta(DB0, DB1):
    """Per-plate keys of each input block that differ between two databases, and the
    notes that differ: {block: set(plate keys)}, {block} for notes."""
    keys, notes = {}, set()
    for blk in A.INPUT_BLOCKS:
        b0 = (DB0 or {}).get(blk, {}) or {}
        b1 = (DB1 or {}).get(blk, {}) or {}
        d0, d1 = b0.get('data', {}) or {}, b1.get('data', {}) or {}
        ks = {k for k in set(d0) | set(d1) if d0.get(k) != d1.get(k)}
        if ks:
            keys[blk] = ks
        if {k: v for k, v in b0.items() if k != 'data'} != {k: v for k, v in b1.items() if k != 'data'}:
            notes.add(blk)
    return keys, notes


def fmt(v, nd=4):
    if isinstance(v, bool):
        return 'yes' if v else 'no'
    if isinstance(v, float):
        return ('%%.%df' % nd) % v
    if isinstance(v, int):
        return '{:,}'.format(v)
    return str(v)


def report(c, DB, VECM, against='origin/main', VOL=None, DB0=None, VOL0=None):
    """The numbers a correction's write-up needs, against the atlas on `against`:
    the region before and after, what else moved and where, the volumes that moved,
    and the summaries side by side. Returns (markdown, dict)."""
    p, ab = c['plate'], c['abbr']
    if DB0 is None:
        DB0 = db_at(against)
    if VOL is None:
        with open(A.VOLUMES, encoding='utf8') as f:
            VOL = json.load(f)
    if VOL0 is None:
        VOL0 = volumes_at(against)
    S = {s['abbr']: s['name'] for s in DB['structures']}
    fr = A.Frame(DB['plate_frame'])
    md = ['## `%s` on plate %d, against `%s`' % (ab, p, against), '']
    rep = {'id': c['id'], 'plate': p, 'abbr': ab, 'against': against}
    if DB0 is None:
        md.append('`%s` is not a ref this checkout can read; nothing to compare with.' % against)
        return '\n'.join(md) + '\n', rep

    R0, R1 = DB0['region_extents']['data'], DB['region_extents']['data']
    e0, e1 = R0.get(str(p), {}).get(ab), R1.get(str(p), {}).get(ab)
    l0, r0 = hemispheres(e0, fr)
    l1, r1 = hemispheres(e1, fr)
    ps0, s0 = series(DB0, ab)
    ps1, s1 = series(DB, ab)
    v0 = (VOL0 or {}).get('data', {}).get(ab, {}) if VOL0 else {}
    v1 = (VOL or {}).get('data', {}).get(ab, {}) if VOL else {}
    row = lambda name, a, b: '| %s | %s | %s |' % (name, a, b if a == b else '**%s**' % b)
    md += ['| | `%s` | this branch |' % against, '| --- | --- | --- |',
           row('`%s`, plate %d' % (ab, p),
               '%s mm², %d polygon%s' % (fmt(e0['a']), len(e0['g']), 's'[:len(e0['g']) != 1]) if e0 else 'no area',
               '%s mm², %d polygon%s' % (fmt(e1['a']), len(e1['g']), 's'[:len(e1['g']) != 1]) if e1 else 'no area'),
           row('— left hemisphere', '%s mm²' % fmt(l0), '%s mm²' % fmt(l1)),
           row('— right hemisphere', '%s mm²' % fmt(r0), '%s mm²' % fmt(r1)),
           row('traced share, per polygon',
               ', '.join('%.2f' % s for s in e0['s']) if e0 else '—',
               ', '.join('%.2f' % s for s in e1['s']) if e1 else '—'),
           row('`%s` over the series' % ab,
               '%s mm² on %d plate%s' % (fmt(s0, 3), len(ps0), 's'[:len(ps0) != 1]),
               '%s mm² on %d plate%s' % (fmt(s1, 3), len(ps1), 's'[:len(ps1) != 1])),
           row('volume', '%s mm³, %d component%s' % (fmt(v0.get('volume_mm3', 0.0)), len(v0.get('components', [])), 's'[:len(v0.get('components', [])) != 1]) if v0 else '—',
               '%s mm³, %d component%s' % (fmt(v1.get('volume_mm3', 0.0)), len(v1.get('components', [])), 's'[:len(v1.get('components', [])) != 1]) if v1 else '—'),
           '']
    pv = c.get('preview')
    if pv and e1:
        agree = abs(float(pv.get('area_mm2', -1)) - e1['a']) <= MOVED_MM2
        md.append('The reader\'s **Recut** showed `%s` at %s mm² before sending; the re-cut here %s.'
                  % (ab, fmt(float(pv['area_mm2'])), 'agrees' if agree else
                     '**gives %s mm² instead**, so an input other than the marks changed under it, '
                     'or the fix applied is not the one the reader previewed' % fmt(e1['a'])))
        md.append('')
        rep['preview_agrees'] = agree
    rep['region'] = {'before': e0 and {'a': e0['a'], 'n': len(e0['g']), 'left': l0, 'right': r0},
                     'after': e1 and {'a': e1['a'], 'n': len(e1['g']), 'left': l1, 'right': r1},
                     'series': [s0, s1], 'plates': [ps0, ps1],
                     'volume': [v0.get('volume_mm3'), v1.get('volume_mm3')],
                     'components': [len(v0.get('components', [])), len(v1.get('components', []))]}

    # what else moved
    diff = entries_diff(DB0, DB)
    rep['moved'] = sorted(diff)
    here = [(k, v) for k, v in diff.items() if k[0] == p and k[1] != ab]
    elsewhere = [(k, v) for k, v in diff.items() if k[0] != p]
    md.append('### What else moved')
    md.append('')
    if not here and not elsewhere:
        md.append('No other (plate, region) entry moves against `%s`.' % against)
    if here:
        md.append('%d other entr%s on plate %d, none by more than %s mm²:'
                  % (len(here), 'y' if len(here) == 1 else 'ies', p,
                     fmt(max(abs((v[1]['a'] if v[1] else 0) - (v[0]['a'] if v[0] else 0)) for _k, v in here))))
        md.append('')
        md.append('| entry | `%s` | this branch | Δ mm² |' % against)
        md.append('| --- | --- | --- | --- |')
        for (pp, a), (x, y) in sorted(here, key=lambda kv: -abs((kv[1][1]['a'] if kv[1][1] else 0) - (kv[1][0]['a'] if kv[1][0] else 0))):
            xa, ya = (x['a'] if x else 0.0), (y['a'] if y else 0.0)
            md.append('| `%s` | %s | %s | %+.4f |' % (a, fmt(xa) if x else 'no area', fmt(ya) if y else 'no area', ya - xa))
        md.append('')
    if elsewhere:
        md.append('**%d entr%s on other plates move%s** -- a correction is plate-local, so each of these '
                  'wants a reason (main re-cut under the branch, or an input the branch changed there):'
                  % (len(elsewhere), 'y' if len(elsewhere) == 1 else 'ies', 's' if len(elsewhere) == 1 else ''))
        md.append('')
        md.append('| plate | entry | `%s` | this branch |' % against)
        md.append('| --- | --- | --- | --- |')
        for (pp, a), (x, y) in elsewhere:
            md.append('| %d | `%s` | %s | %s |' % (pp, a, fmt(x['a']) if x else 'no area', fmt(y['a']) if y else 'no area'))
        md.append('')

    # volumes
    vm = []
    if VOL0 and VOL:
        d0, d1 = VOL0['data'], VOL['data']
        for a in sorted(set(d0) | set(d1)):
            x, y = d0.get(a), d1.get(a)
            if (x is None) != (y is None) or (x and (abs(x['volume_mm3'] - y['volume_mm3']) > MOVED_MM2
                                                 or len(x['components']) != len(y['components']))):
                vm.append((a, x, y))
    rep['volumes_moved'] = [a for a, _x, _y in vm]
    md.append('### Volumes')
    md.append('')
    if not VOL0 or not VOL:
        md.append('The volumes on one side could not be read.')
    elif not vm:
        md.append('No volume moves.')
    else:
        md.append('%d volume%s move%s (the label volume interpolates between plates, so a boundary '
                  'that moves on one redistributes voxels in the slabs either side):'
                  % (len(vm), 's'[:len(vm) != 1], 's' if len(vm) == 1 else ''))
        md.append('')
        md.append('| structure | `%s` | this branch | components |' % against)
        md.append('| --- | --- | --- | --- |')
        for a, x, y in sorted(vm, key=lambda t: -abs((t[2]['volume_mm3'] if t[2] else 0) - (t[1]['volume_mm3'] if t[1] else 0))):
            md.append('| `%s` | %s | %s | %s |' % (
                a, fmt(x['volume_mm3']) if x else 'none', fmt(y['volume_mm3']) if y else 'none',
                '%d' % len(y['components']) if x and y and len(x['components']) == len(y['components'])
                else '%s → %s' % (len(x['components']) if x else 0, len(y['components']) if y else 0)))
        md.append('')

    # the atlas as a whole
    md.append('### The atlas as a whole')
    md.append('')
    md.append('| | `%s` | this branch |' % against)
    md.append('| --- | --- | --- |')
    sums = {}
    sm0, sm1 = DB0['region_extents']['summary'], DB['region_extents']['summary']
    for k in ('boundary_edges_shared_exactly', 'structure_plate_entries', 'polygons', 'points',
              'faces_named_by_one_abbreviation', 'seeds_moved_by_hand',
              'entries_without_a_drawn_outline', 'section_covered_mean',
              'label_inside_its_own_region', 'section_area_residual_worst_plate'):
        if k in sm0 or k in sm1:
            sums[k] = (sm0.get(k), sm1.get(k))
            md.append(row('`%s`' % k, fmt(sm0.get(k)), fmt(sm1.get(k))))
    c0, c1 = DB0.get('region_colors', {}).get('summary', {}), DB.get('region_colors', {}).get('summary', {})
    for k in ('regions', 'patches', 'colors'):
        if k in c0 or k in c1:
            sums['colors.' + k] = (c0.get(k), c1.get(k))
            md.append(row('coloring: %s' % k, fmt(c0.get(k)), fmt(c1.get(k))))
    if VOL0 and VOL:
        for k in ('structures',):
            sums['volumes.' + k] = (VOL0['summary'].get(k), VOL['summary'].get(k))
            md.append(row('meshes: %s' % k, fmt(VOL0['summary'].get(k)), fmt(VOL['summary'].get(k))))
        for k in ('unnamed_fraction', 'regions_partition_the_volume'):
            sums['volumes.' + k] = (VOL0['checks'].get(k), VOL['checks'].get(k))
            md.append(row('label volume: `%s`' % k, fmt(VOL0['checks'].get(k)), fmt(VOL['checks'].get(k))))
    rep['summary'] = sums
    md.append('')
    bese = sm1.get('boundary_edges_shared_exactly')
    if bese != 1.0:
        md.append('**`boundary_edges_shared_exactly` is %s, not 1.0: the regions do not tile.**' % bese)
        md.append('')
    # inputs
    keys, notes = input_delta(DB0, DB)
    rep['inputs'] = {k: sorted(v, key=int) for k, v in keys.items()}
    svgs = git_out('diff', '--name-only', against, '--', 'svg/', check=False).split()
    rep['svg'] = svgs
    md.append('### Inputs this branch changes')
    md.append('')
    for blk, ks in sorted(keys.items()):
        md.append('- `%s` on plate%s %s' % (blk, 's'[:len(ks) != 1], ', '.join(sorted(ks, key=int))))
    for s in svgs:
        md.append('- `%s`' % s)
    for blk in sorted(notes):
        md.append('- the `%s` note' % blk)
    if not keys and not svgs and not notes:
        md.append('None: no input block or tracing differs from `%s`.' % against)
    md.append('')
    return '\n'.join(md), rep


# --------------------------------------------------------------------- rebase

def corrections_since(base):
    """The correction files this branch added since `base`, loaded."""
    names = git_out('diff', '--name-only', '--diff-filter=A', base, 'HEAD', '--',
                    'corrections/*.json', check=False).split()
    return [load(os.path.join(A.ROOT, n)) for n in names]


def derived_paths():
    """Every committed path the pipeline writes, as git pathspecs."""
    return list(A.DERIVED_PATHS)


def rebase(against='origin/main', dry=False, no_build=False, quiet=False):
    """Bring a correction branch up to `against` without merging a derived file.

    The rule is the one every hand merge so far followed: the inputs are merged, the
    derived files are `against`'s, and the pipeline is run again on the result. Then it
    checks the re-cut did what the branch did -- the same (plate, region) entries move
    against the new base as moved against the old one, less any the base moved itself,
    and the corrected region's rings come out identical -- and commits the merge with
    the report as its body. Exit 0 with the branch current; 1 where it stopped, with the
    tree left as it stands so a person or a session can take it from there.
    """
    say = (lambda *a: None) if quiet else print
    if git_out('status', '--porcelain', '--untracked-files=no', check=False).strip():
        raise SystemExit('the working tree is not clean; commit or stash first')
    head = git_out('rev-parse', 'HEAD').strip()
    tip = git_out('rev-parse', against).strip()
    base = git_out('merge-base', 'HEAD', against).strip()
    if base == tip:
        say('already current with %s (%s)' % (against, tip[:7]))
        return 0
    DBh, DBb, DBm = db_at('HEAD'), db_at(base), db_at(against)
    ours, our_notes = input_delta(DBb, DBh)
    theirs, _their_notes = input_delta(DBb, DBm)
    our_svg = set(git_out('diff', '--name-only', base, 'HEAD', '--', 'svg/', check=False).split())
    their_svg = set(git_out('diff', '--name-only', base, against, '--', 'svg/', check=False).split())
    corrs = corrections_since(base)
    say('branch %s, base %s, %s %s' % (head[:7], base[:7], against, tip[:7]))
    say('  corrections on the branch: %s' % (', '.join(c['id'] for c in corrs) or 'none'))
    say('  inputs the branch changed: %s' % (', '.join('%s[%s]' % (k, ','.join(sorted(v, key=int)))
                                                     for k, v in sorted(ours.items())) or 'none'))
    if our_svg:
        say('  tracings the branch changed: %s' % ', '.join(sorted(our_svg)))
    clash = [(k, sorted(ours[k] & theirs.get(k, set()), key=int)) for k in ours if ours[k] & theirs.get(k, set())]
    clash = [(k, v) for k, v in clash if v]
    if clash or (our_svg & their_svg):
        say('STOP: both sides changed the same input -- %s%s. That is the one merge a person makes.'
            % ('; '.join('%s on plate%s %s' % (k, 's'[:len(v) != 1], ', '.join(v)) for k, v in clash),
               ('; tracings ' + ', '.join(sorted(our_svg & their_svg))) if our_svg & their_svg else ''))
        return 1
    if our_notes:
        say('  note: the branch edited the %s note%s; %s\'s is kept (notes are static now; the '
            'reason goes in the row and the changelog)' % (', '.join(sorted(our_notes)), 's'[:len(our_notes) != 1], against))
    old_moved = entries_diff(DBb, DBh)
    main_moved = entries_diff(DBb, DBm)
    say('  entries the branch moved against its base: %d; entries %s moved since: %d'
        % (len(old_moved), against, len(main_moved)))
    if dry:
        say('--dry-run: nothing merged')
        return 0

    # the merge, and the derived files resolved to `against`
    git_out('merge', '--no-commit', '--no-ff', against, check=False)
    conflicted = set(git_out('diff', '--name-only', '--diff-filter=U', check=False).split())
    rel_db = os.path.relpath(A.JSON, A.ROOT).replace(os.sep, '/')
    git_out('checkout', tip, '--', *derived_paths(), check=False)
    # the database: theirs, with our input rows laid on it
    for blk, ks in ours.items():
        DBm.setdefault(blk, {'note': '', 'data': {}})
        for k in ks:
            if k in DBh[blk]['data']:
                DBm[blk]['data'][k] = DBh[blk]['data'][k]
            else:
                DBm[blk]['data'].pop(k, None)
        if blk == 'seed_overrides':
            DBm[blk]['data'] = {k: {a: DBm[blk]['data'][k][a] for a in sorted(DBm[blk]['data'][k])}
                                for k in sorted(DBm[blk]['data'], key=int)}
    A.save_db(DBm)
    git_out('add', '--', rel_db)
    conflicted.discard(rel_db)
    for path in list(conflicted):
        if any(_glob_match(path, g) for g in derived_paths()):
            conflicted.discard(path)                 # checked out above
        elif path == 'CHANGELOG.md':
            _union_merge(path)
            conflicted.discard(path)
    if conflicted:
        say('STOP: conflicts outside the derived files, which this does not resolve: %s'
            % ', '.join(sorted(conflicted)))
        say('  resolve them, `git add`, then: python3 tools/pipeline.py rebuild && '
            'python3 tools/pipeline.py check, and commit the merge')
        return 1
    git_out('add', '-u')

    # the re-cut
    if not (ours or our_svg):
        say('the branch changes no input: nothing to re-cut')
    elif no_build:
        say('--no-build: the merge is staged and the pipeline has not run; run it before committing')
        return 1
    else:
        import subprocess
        for cmd in (['rebuild'], ['check', '--quiet']):
            r = subprocess.run([sys.executable, os.path.join(A.ROOT, 'tools', 'pipeline.py')] + cmd,
                               cwd=A.ROOT)
            if r.returncode:
                say('STOP: pipeline.py %s failed; the merge is staged and unbuilt' % cmd[0])
                return 1
        git_out('add', '-u')

    # the pictures of what the correction did are drawn against the new base
    if corrs and (ours or our_svg) and not no_build:
        DBq = A.load_db()
        VECMq = A.vec_matrices()
        for c in corrs:
            inspect(c, DBq, VECMq, want_qc=True, quiet=True, before=against)
            git_out('add', '--', 'qc/chk_corr_%s.png' % c['id'], 'qc/chk_corr_%s_site.png' % c['id'])

    # did the re-cut do what the branch did?
    DBn = A.load_db()
    DBm = db_at(against)
    new_moved = entries_diff(DBm, DBn)
    want = set(old_moved) - set(main_moved)
    extra = set(new_moved) - set(old_moved) - set(main_moved)
    missing = want - set(new_moved)
    same_rings = []
    for c in corrs:
        p, ab = str(c['plate']), c['abbr']
        g_old = (DBh['region_extents']['data'].get(p, {}).get(ab) or {}).get('g')
        g_new = (DBn['region_extents']['data'].get(p, {}).get(ab) or {}).get('g')
        same_rings.append((c['id'], g_old == g_new, (int(p), ab) in main_moved))
    ok = not extra and not missing and all(s or m for _i, s, m in same_rings)
    lines = ['Merge %s into %s: %s' % (against, git_out('rev-parse', '--abbrev-ref', 'HEAD').strip(),
                                       'the re-cut does what the branch did' if ok else 'the re-cut differs from the branch'),
             '',
             'The inputs are merged, the derived files are %s\'s, and the pipeline was run again '
             'on the result (tools/corrections.py rebase). %s' % (against, 'Nothing derived is resolved by hand.'),
             '',
             'Entries moved against the old base: %d; against %s now: %d; %s moved %d itself.'
             % (len(old_moved), against, len(new_moved), against, len(main_moved))]
    if extra:
        lines.append('Entries that move now and did not before: %s' % ', '.join('%d/%s' % k for k in sorted(extra)))
    if missing:
        lines.append('Entries the branch moved that no longer move: %s' % ', '.join('%d/%s' % k for k in sorted(missing)))
    for cid, same, m in same_rings:
        lines.append('%s: the region\'s rings are %s' % (cid, 'identical to the branch\'s' if same
                                                       else 'different (%s moved that plate)' % against if m
                                                       else 'DIFFERENT from the branch\'s'))
    lines.append('')
    for c in corrs:
        md, _rep = report(c, DBn, A.vec_matrices(), against=against, DB0=DBm, VOL0=volumes_at(against))
        lines.append(md)
    body = '\n'.join(lines)
    say(body)
    if not ok:
        say('STOP: the re-cut on the new base is not the branch\'s fix; the merge is staged, uncommitted')
        return 1
    msg = os.path.join(A.ROOT, 'build', 'rebase-message.txt')
    os.makedirs(os.path.dirname(msg), exist_ok=True)
    with open(msg, 'w', encoding='utf8') as f:
        f.write(body)
    git_out('commit', '-q', '-F', msg)
    say('committed %s' % git_out('rev-parse', '--short', 'HEAD').strip())
    return 0


def _glob_match(path, pattern):
    import fnmatch
    return fnmatch.fnmatch(path, pattern) or path == pattern


def _union_merge(path):
    """Resolve a conflicted text file by keeping both sides' lines (git's `union`
    driver), for a file every change appends to at the same place."""
    import subprocess
    import tempfile
    stages = []
    for n in (1, 2, 3):
        txt = git_out('show', ':%d:%s' % (n, path), check=False)
        fd, tmp = tempfile.mkstemp(prefix='stage%d_' % n)
        with os.fdopen(fd, 'w', encoding='utf8', newline='') as f:
            f.write(txt)
        stages.append(tmp)
    base, ours, theirs = stages
    r = subprocess.run(['git', 'merge-file', '-p', '--union', ours, base, theirs], cwd=A.ROOT,
                       capture_output=True, text=True)
    with open(os.path.join(A.ROOT, path), 'w', encoding='utf8', newline='') as f:
        f.write(r.stdout)
    for t in stages:
        os.remove(t)
    git_out('add', '--', path)


# --------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    i = sub.add_parser('inspect', help='read a correction against the extraction')
    i.add_argument('file', help='corrections/<id>.json, or the id')
    i.add_argument('--qc', action='store_true',
                   help='write qc/chk_corr_<id>.png and qc/chk_corr_<id>_site.png')
    i.add_argument('--before', default='origin/main', metavar='REF',
                   help='the git ref the left panel of the site picture is cut on (origin/main)')
    v = sub.add_parser('validate', help='check one or more corrections without cutting a plate')
    v.add_argument('files', nargs='+', help='corrections/<id>.json, or ids')
    a = sub.add_parser('apply', help='write its boundaries into svg/ and its seeds into seed_overrides')
    a.add_argument('file', help='corrections/<id>.json, or the id')
    a.add_argument('--dry-run', action='store_true', help='report what would change, write nothing')
    r = sub.add_parser('report', help='the numbers a write-up needs, as Markdown, against a git ref')
    r.add_argument('file', help='corrections/<id>.json, or the id')
    r.add_argument('--against', default='origin/main', metavar='REF',
                   help='the atlas to compare with (origin/main)')
    r.add_argument('--out', metavar='PATH', help='also write the Markdown here')
    b = sub.add_parser('rebase', help='bring this correction branch up to a ref: inputs merged, '
                                      'derived files theirs, pipeline run again, merge committed')
    b.add_argument('--onto', default='origin/main', metavar='REF', help='what to merge in (origin/main)')
    b.add_argument('--dry-run', action='store_true', help='say what would be merged and stop')
    b.add_argument('--no-build', action='store_true',
                   help='merge and resolve, but leave the pipeline to be run by hand')
    args = ap.parse_args()

    if args.cmd == 'rebase':
        sys.exit(rebase(against=args.onto, dry=args.dry_run, no_build=args.no_build))
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
        inspect(c, DB, VECM, want_qc=args.qc, before=args.before)
    elif args.cmd == 'report':
        md, _rep = report(c, DB, VECM, against=args.against)
        print(md)
        if args.out:
            os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
            with open(args.out, 'w', encoding='utf8') as f:
                f.write(md)
    else:
        apply(c, DB, VECM, dry=args.dry_run)


if __name__ == '__main__':
    main()
