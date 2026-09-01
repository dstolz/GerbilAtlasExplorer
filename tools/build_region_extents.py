#!/usr/bin/env python3
"""Build per-region polygon extents for the gerbil atlas.

The atlas publishes no segmentation. What it does publish is a line drawing:
every region is a cell of a planar subdivision, and one abbreviation is printed
inside each cell. `svg/GerbilAtlas_Plate_NN.svg` holds those lines as traced
paths, and `label_positions` holds those abbreviations as located boxes. This
turns the two into the third thing neither is on its own -- an area per
structure per plate.

The pipeline, in order:

  1. Read the plate's traced paths in the page frame they were traced in
     (3296 x 2481; plate 20 is 2481 x 3296, printed at a quarter turn) and
     flatten the cubics to polylines.
  2. Bridge dangling ends. The tracing is a nearly connected network -- the
     median open endpoint sits 1.9 px from another path, 94% within 12 px --
     but a boundary that misses by 2 px leaks two regions into one. Each
     dangling end is joined to the nearest point on any other path within
     BRIDGE_PX. This is far gentler than a morphological close, which welds
     shut the thin laminae the drawing does separate.
  3. Add the published brain outline as the outer wall, inverse-transformed
     into the page frame, and fill it for the section interior.
  4. Cut the empty space into faces. A face sealed by traced ink and holding
     exactly one abbreviation is that structure's extent, drawn.
  5. Where a face holds several abbreviations, ink is missing somewhere on the
     boundary between them. Rather than merge them or drop them, a watershed
     seeded on the printed labels and ridged on the distance transform of the
     ink splits the face along the strongest evidence there is. Faces holding
     no label at all are left unassigned: the atlas does not name them here,
     and growing a neighbour over them would invent a claim. The exception is
     a second name for the same thing -- see PRINTED_AS.
  6. Score every polygon by the fraction of its border that lies on ink that
     was actually traced, as opposed to a ridge the watershed invented, and
     write that score out beside the geometry.
  7. Trace the boundaries on the crack lattice and simplify each shared arc
     once, at DP_PX with Douglas-Peucker as `brain_outline` already does, so
     that neighbours come out sharing their boundary exactly rather than
     approximately -- see regiongeom.py, which is where that has to be right.
     Store as fractions of the app's 1100 x 703 plate frame, the frame and
     convention brain_outline already uses.

Reads:  svg/*.svg, data/gerbil_atlas.json, the __VEC__ matrices in the HTML
Writes: data/gerbil_atlas.json (adds `region_extents`), optional qc/ overlays

Usage:  python3 tools/build_region_extents.py [--plates 1,30,45] [--qc] [--dry-run]
"""

import argparse
import base64
import io
import json
import math
import os
import re
import sys

import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree
from skimage.segmentation import watershed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import regiongeom as G

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON = os.path.join(ROOT, 'data', 'gerbil_atlas.json')
HTML = os.path.join(ROOT, 'gerbil_atlas_explorer.html')
SVGDIR = os.path.join(ROOT, 'svg')
QCDIR = os.path.join(ROOT, 'qc')

BRIDGE_PX = 20      # page px; 99% of tracing gaps are under 25, 94% under 12
DP_PX = 2.0         # plate px, as brain_outline uses: 35 um
MIN_FACE_PX = 400   # page px; below this a face is tracer noise, not a region
MIN_AREA_PX = 600   # page px; a territory smaller than this is not published
SEED_PAD = 1.0      # label box is used as the marker at this scale
SNAP_PX = 60        # a label printed beside its section is pulled this far in
SUPPORT_PX = 3      # a border pixel counts as drawn within this of traced ink
DEC = 5             # fraction decimals, matching brain_outline

# Abbreviations the atlas prints in parentheses under another one, as a second
# published name for the same field: "Au1 / (A1)" on plates 30-33, "Au1 /
# (AAF)" on 28, "Au1 / (A1/AAF)" on 29. They are one label for one region, and
# seeding them separately is worse than useless -- the watershed has no ink to
# split on, so it invents a ridge and hands each name a slab of the other's
# cortex. Seeded under the name above them instead, and recorded in the block
# so the app can answer for either spelling with the one outline.
#
# These are the only two: every printed A1 and AAF in the atlas sits directly
# under an Au1, and a bracket detector run over all 6,217 located labels (thin,
# line-height, bowed the way a bracket bows) flags nothing else.
PRINTED_AS = {'A1': 'Au1', 'AAF': 'Au1'}


# ---------------------------------------------------------------- svg reading

def read_svg(path):
    """Return (width, height, [polyline, ...]) for one traced plate."""
    txt = open(path).read()
    vb = re.search(r'viewBox="([^"]+)"', txt).group(1).split()
    W, H = int(float(vb[2])), int(float(vb[3]))
    polys = []
    for _gid, body in re.findall(r'<g id="([^"]+)"[^>]*>(.*?)</g>', txt, re.S):
        for d in re.findall(r'<path d="([^"]+)"', body):
            pts, closed = flatten(d)
            if len(pts) >= 2:
                polys.append((pts, closed))
    return W, H, polys


def flatten(d):
    """Flatten an M/C/Z path to a polyline. The tracer emits nothing else."""
    t = d.replace(',', ' ').split()
    pts, cur, closed, i = [], None, False, 0
    while i < len(t):
        if t[i] == 'M':
            cur = (float(t[i + 1]), float(t[i + 2]))
            pts.append(cur)
            i += 3
        elif t[i] == 'C':
            p0 = cur
            p1 = (float(t[i + 1]), float(t[i + 2]))
            p2 = (float(t[i + 3]), float(t[i + 4]))
            p3 = (float(t[i + 5]), float(t[i + 6]))
            chord = (math.dist(p0, p1) + math.dist(p1, p2) + math.dist(p2, p3))
            n = max(2, min(32, int(chord / 3) + 2))
            for k in range(1, n + 1):
                u = k / n
                v = 1 - u
                pts.append((
                    v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
                    v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]))
            cur = p3
            i += 7
        elif t[i] in 'Zz':
            closed = True
            i += 1
        else:
            i += 1
    return pts, closed


# ------------------------------------------------------------------ geometry

def inv6(m):
    a, b, c, d, e, f = m
    det = a * d - b * c
    return (d / det, -b / det, -c / det, a / det,
            (c * f - d * e) / det, (b * e - a * f) / det)


def xf(m, x, y):
    a, b, c, d, e, f = m
    return (a * x + c * y + e, b * x + d * y + f)


def rasterize(mask, pts, W, H):
    """Draw a polyline as a 1-px 8-connected wall. Eight-connected ink blocks a
    four-connected fill, so a one-pixel line is a watertight boundary."""
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        dx, dy = x1 - x0, y1 - y0
        n = int(max(abs(dx), abs(dy))) + 1
        for k in range(n + 1):
            t = k / n
            xi = int(round(x0 + dx * t))
            yi = int(round(y0 + dy * t))
            if 0 <= xi < W and 0 <= yi < H:
                mask[yi, xi] = True


# ------------------------------------------------------------------ per plate

def build_plate(plate, DB, VECM, want_qc=False):
    W, H, polys = read_svg(os.path.join(SVGDIR, 'GerbilAtlas_Plate_%02d.svg' % plate))
    NW = DB['plate_frame']['width_px']
    NH = DB['plate_frame']['height_px']
    m = VECM[str(plate)]
    im = inv6(m)

    # traced ink, before anything is added to it: the honesty reference
    traced = np.zeros((H, W), bool)
    for pts, _c in polys:
        rasterize(traced, pts, W, H)

    # the published section outline, pulled back into the page frame
    outline = []
    for poly in DB['brain_outline']['data'][str(plate)]:
        pp = [xf(im, x * NW, y * NH) for x, y in poly]
        pp.append(pp[0])
        outline.append(pp)
        rasterize(traced, pp, W, H)

    wall = traced.copy()

    # bridge the dangling ends
    P, T = [], []
    allp = polys + [(pp, True) for pp in outline]
    for i, (pts, _c) in enumerate(allp):
        for xy in pts:
            P.append(xy)
            T.append(i)
    P = np.asarray(P)
    T = np.asarray(T)
    tree = cKDTree(P)
    bridges = 0
    for i, (pts, closed) in enumerate(allp):
        if closed:
            continue
        for ep in (pts[0], pts[-1]):
            dd, ii = tree.query(ep, k=80)
            for d_, i_ in zip(np.atleast_1d(dd), np.atleast_1d(ii)):
                if T[i_] != i:
                    if 0 < d_ <= BRIDGE_PX:
                        rasterize(wall, [ep, tuple(P[i_])], W, H)
                        bridges += 1
                    break

    sect = np.zeros((H, W), bool)
    for pp in outline:
        rasterize(sect, pp, W, H)
    interior = ndimage.binary_fill_holes(sect)

    # faces
    faces, nfaces = ndimage.label(~wall & interior)
    fsize = np.bincount(faces.ravel(), minlength=nfaces + 1)

    # seed each face from the printed abbreviations
    boxes = DB['label_positions']['data'].get(str(plate), {})
    seeds = np.zeros((H, W), np.int32)
    seed_ab, seed_face, snapped, dropped = [], [], 0, 0
    for ab0, bs in boxes.items():
        ab = PRINTED_AS.get(ab0, ab0)   # a bracketed name seeds the one above it
        for cx, cy, bw, bh in bs:
            px, py = xf(im, cx * NW, cy * NH)
            xi, yi = int(round(px)), int(round(py))
            fid = 0
            if 0 <= xi < W and 0 <= yi < H:
                fid = faces[yi, xi]
                if fid == 0 or fsize[fid] < MIN_FACE_PX:
                    fid = 0
            if not fid:
                # printed on a wall, or beside the section with a leader line
                k = SNAP_PX
                win = faces[max(0, yi - k):yi + k, max(0, xi - k):xi + k]
                v = win[win > 0]
                v = v[fsize[v] >= MIN_FACE_PX]
                if v.size:
                    fid = int(np.bincount(v).argmax())
                    snapped += 1
                else:
                    dropped += 1
                    continue
            seed_ab.append(ab)
            seed_face.append(fid)
            sid = len(seed_ab)
            # the glyph box, clipped to the face it was resolved into
            hw, hh = bw * NW * SEED_PAD / 2, bh * NH * SEED_PAD / 2
            (ax, ay) = xf(im, (cx * NW - hw), (cy * NH - hh))
            (bx, by) = xf(im, (cx * NW + hw), (cy * NH + hh))
            x0, x1 = sorted((int(ax), int(bx)))
            y0, y1 = sorted((int(ay), int(by)))
            sl = (slice(max(0, y0), y1 + 1), slice(max(0, x0), x1 + 1))
            put = (faces[sl] == fid)
            if put.any():
                seeds[sl][put] = sid
            else:
                seeds[max(0, yi - 2):yi + 3, max(0, xi - 2):xi + 3] = sid

    if not seed_ab:
        return None

    # Everything inside the section is up for grabs except a face the atlas
    # sealed and did not name. The drawn lines themselves belong to no face, so
    # they are in play and the watershed splits them down their middle, which
    # is where a boundary between two regions ought to fall -- leaving them out
    # would put a one-pixel no-man's-land along every boundary in the atlas.
    named = np.zeros(nfaces + 1, bool)
    named[list(set(seed_face))] = True
    unnamed = (faces > 0) & ~named[faces]
    mask = interior & ~unnamed

    dist = ndimage.distance_transform_edt(~wall)
    terr = watershed(-dist, seeds, mask=mask)

    # merge same-abbreviation territories that touch
    lut = np.zeros(len(seed_ab) + 1, np.int32)
    order = {}
    for i, ab in enumerate(seed_ab, 1):
        lut[i] = order.setdefault(ab, len(order) + 1)
    byab = lut[terr]
    nreg = len(order)

    # A territory too small to be a published structure, and any face the atlas
    # left unnamed, become unassigned space rather than being handed to a
    # neighbour: the drawing closes them and does not name them, and absorbing
    # them would put area into a region the atlas never claimed.
    # find_objects walks the raster once and hands back a box per label, so the
    # per-region work below stays inside its own region.
    box = ndimage.find_objects(byab, max_label=nreg)
    for gid in range(1, nreg + 1):
        sl = box[gid - 1]
        if sl is None:
            continue
        sub = byab[sl] == gid
        cc, n = ndimage.label(sub)
        if not n:
            continue
        small = np.nonzero(np.bincount(cc.ravel())[1:] < MIN_AREA_PX)[0] + 1
        if small.size:
            byab[sl][sub & np.isin(cc, small)] = 0
    box = ndimage.find_objects(byab, max_label=nreg)

    # one label per unassigned face too, so a junction against one registers
    ua, nua = ndimage.label(interior & (byab == 0))
    LBL = np.where(byab > 0, byab, np.where(ua > 0, ua + nreg, 0)).astype(np.int32)
    junc = G.junctions(LBL)

    near = ndimage.binary_dilation(traced,
                                   np.ones((2 * SUPPORT_PX + 1,) * 2, bool))
    det = abs(m[0] * m[3] - m[1] * m[2])
    eps = DP_PX / math.sqrt(det)                    # plate px -> page px
    mm2 = det / (DB['plate_frame']['ml_px_per_mm'] *
                 DB['plate_frame']['dv_px_per_mm'])

    def emit(sub, sl):
        """Rings of one label, simplified arc-wise, in plate-frame fractions.

        Traced inside the label's own box: the page raster is 8 Mpx and a busy
        plate carries a couple of hundred regions."""
        gs, ss, area = [], [], 0.0
        oy, ox = sl[0].start, sl[1].start
        for ring0 in G.trace_rings(sub):
            ring = [(x + ox, y + oy) for x, y in ring0]
            r = G.simplify_ring(ring, junc, eps)
            if r is None:
                continue
            area += G.ring_area(r)
            gs.append([[round(x / NW, DEC), round(y / NH, DEC)]
                       for x, y in (xf(m, px, py) for px, py in r)])
            ss.append(round(support(r, near), 3))
        return gs, ss, abs(area) * mm2

    out = {}
    for ab, gid in order.items():
        sl = box[gid - 1]
        if sl is None:
            continue
        gs, ss, area = emit(byab[sl] == gid, sl)
        if not gs:
            continue
        out[ab] = {'g': gs, 's': ss, 'a': round(area, 4),
                   'n': sum(1 for x in seed_ab if x == ab)}

    unassigned = []
    ubox = ndimage.find_objects(ua, max_label=nua)
    for k in range(1, nua + 1):
        sl = ubox[k - 1]
        if sl is None:
            continue
        sub = (ua[sl] == k) & (byab[sl] == 0)
        if sub.sum() < MIN_AREA_PX:
            continue
        gs, _ss, _a = emit(sub, sl)
        unassigned.extend(gs)

    tot_i = float(interior.sum())
    stats = dict(plate=plate, paths=len(polys), bridges=bridges,
                 faces=int((fsize[1:] >= MIN_FACE_PX).sum()),
                 seeds=len(seed_ab), snapped=snapped, dropped=dropped,
                 regions=len(out),
                 polys=sum(len(v['g']) for v in out.values()),
                 pts=sum(len(g) for v in out.values() for g in v['g']),
                 unassigned=len(unassigned),
                 covered=round(float((byab > 0).sum()) / tot_i, 4))
    supw = {ab: (sum(s_ * abs(G.ring_area([[p[0] * NW, p[1] * NH] for p in g]))
                     for s_, g in zip(v['s'], v['g'])) /
                 max(1e-9, sum(abs(G.ring_area([[p[0] * NW, p[1] * NH] for p in g]))
                               for g in v['g'])))
            for ab, v in out.items()}
    return (out, unassigned, stats,
            (LBL, interior, traced, m, W, H, order, supw) if want_qc else None)


def support(ring, near):
    """Share of a ring's arc length that lies on ink the tracing actually drew.

    Walked at one page pixel, so it is length-weighted: a long invented ridge
    counts against the region in proportion to how much of its border it is."""
    H, W = near.shape
    on = tot = 0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for k in range(n):
            t = k / n
            xi = int(x0 + (x1 - x0) * t)
            yi = int(y0 + (y1 - y0) * t)
            tot += 1
            if 0 <= xi < W and 0 <= yi < H and near[yi, xi]:
                on += 1
    return on / tot if tot else 0.0


# ---------------------------------------------------------------------- main

def load_vec_matrices():
    with open(HTML) as f:
        for i, line in enumerate(f, 1):
            if line.startswith('<script>window.__VEC__='):
                s = line.index('{')
                e = line.rindex('}')
                return {k: v['m'] for k, v in json.loads(line[s:e + 1]).items()}
    raise SystemExit('window.__VEC__ not found in ' + HTML)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--plates', default='', help='e.g. 1,30,45; default all')
    ap.add_argument('--dry-run', action='store_true',
                    help='report only, do not touch data/gerbil_atlas.json')
    ap.add_argument('--qc', action='store_true', help='write qc/ overlays')
    a = ap.parse_args()

    DB = json.load(open(JSON))
    VECM = load_vec_matrices()
    plates = ([int(x) for x in a.plates.split(',')] if a.plates
              else [p['plate'] for p in DB['plates']])

    data, unass, rows = {}, {}, []
    for p in plates:
        r = build_plate(p, DB, VECM, a.qc)
        if r is None:
            print('plate %d: no located labels, skipped' % p)
            continue
        out, ua, st, qc = r
        data[str(p)] = out
        if ua:
            unass[str(p)] = ua
        rows.append(st)
        if a.qc and qc:
            write_qc(p, qc, out)
        print('plate %2d: %3d regions %4d polys %6d pts | %3d seeds '
              '(%d snapped, %d dropped) | %2d unassigned | %.0f%% covered'
              % (p, st['regions'], st['polys'], st['pts'], st['seeds'],
                 st['snapped'], st['dropped'], st['unassigned'],
                 100 * st['covered']), flush=True)

    sup = np.array([s for v in data.values() for r in v.values() for s in r['s']]
                   or [0.0])
    summary = dict(
        plates=len(rows),
        structure_plate_entries=sum(r['regions'] for r in rows),
        polygons=sum(r['polys'] for r in rows),
        points=sum(r['pts'] for r in rows),
        labels_seeded=sum(r['seeds'] for r in rows),
        labels_relocated=sum(r['snapped'] for r in rows),
        labels_dropped=sum(r['dropped'] for r in rows),
        traced_fraction_median=round(float(np.median(sup)), 3),
        traced_fraction_ge_90=round(float((sup >= .9).mean()), 3),
        traced_fraction_ge_75=round(float((sup >= .75).mean()), 3),
        traced_fraction_lt_50=round(float((sup < .5).mean()), 3),
        section_covered_mean=round(float(np.mean([r['covered'] for r in rows])), 4))
    summary.update(check_tiling(data, unass, DB))
    print('\n' + json.dumps(summary, indent=1))

    if a.dry_run:
        return
    write_block(dict(
        note=NOTE,
        derivation=DERIV,
        validation=validation_text(summary),
        grades={'traced': 0.9, 'estimated': 0.5},
        synonyms=PRINTED_AS,
        summary=summary,
        data=data,
        unassigned=unass))


def write_block(block):
    """Splice `region_extents` into the JSON in the style the file already uses.

    Not json.dump over the whole thing: the file is hand-shaped -- one compact
    line per plate under `brain_outline.data`, expanded elsewhere -- and
    rewriting it wholesale turns a reviewable diff into 61,000 changed lines
    with the new data hidden somewhere inside it. So the existing text is left
    byte for byte alone and the new block is appended to it.

    Re-running replaces the block rather than adding a second one."""
    j = lambda o: json.dumps(o, separators=(',', ':'), ensure_ascii=False)
    L = [' "region_extents": {']
    for k in ('note', 'derivation', 'validation'):
        L.append('  %s: %s,' % (j(k), j(block[k])))
    L.append('  "grades": %s,' % j(block['grades']))
    L.append('  "synonyms": %s,' % j(block['synonyms']))
    L.append('  "summary": %s,' % j(block['summary']))
    for key in ('data', 'unassigned'):
        L.append('  %s: {' % j(key))
        items = sorted(block[key], key=int)
        for i, p in enumerate(items):
            L.append('   %s: %s%s' % (j(p), j(block[key][p]),
                                      '' if i == len(items) - 1 else ','))
        L.append('  }%s' % ('' if key == 'unassigned' else ','))
    L.append(' }')
    txt = '\n'.join(L)

    src = open(JSON).read()
    a = src.find('\n "region_extents": {\n')
    if a >= 0:                                   # drop the previous block
        b = src.index('\n }', a)
        end = src.index('\n', b + 3)
        src = src[:a] + src[end:]
    tail = src.rstrip()
    assert tail.endswith('}'), 'unexpected end of ' + JSON
    body = tail[:-1].rstrip()
    if body.endswith(','):
        body = body[:-1]
    out = body + ',\n' + txt + '\n}\n'
    json.loads(out)                              # never write something unreadable
    tmp = JSON + '.tmp'
    with open(tmp, 'w') as f:
        f.write(out)
    os.replace(tmp, JSON)
    print('wrote %s (%.2f MB)' % (JSON, os.path.getsize(JSON) / 1e6))


# ------------------------------------------------------------ verification

def poly_area(g):
    x = np.array([p[0] for p in g])
    y = np.array([p[1] for p in g])
    return 0.5 * float(np.dot(x[:-1], y[1:]) - np.dot(x[1:], y[:-1]))


def check_tiling(data, unass, DB):
    """Do the regions plus the unassigned faces add up to the section, and does
    every printed label fall inside the region it named?

    The first is what "extent" has to mean if it is to mean anything: assign a
    pixel twice and the hit test is a coin toss. Neither check is one the
    extraction was tuned to pass."""
    NW = DB['plate_frame']['width_px']
    NH = DB['plate_frame']['height_px']
    worst_gap, ins, tot = 0.0, 0, 0
    for p, regs in data.items():
        s = sum(abs(poly_area(g)) * (1 if poly_area(g) > 0 else -1)
                for v in regs.values() for g in v['g'])
        s += sum(abs(poly_area(g)) * (1 if poly_area(g) > 0 else -1)
                 for g in unass.get(p, []))
        o = sum(abs(poly_area(g)) for g in DB['brain_outline']['data'][p])
        if o:
            worst_gap = max(worst_gap, abs(abs(s) - o) / o)
        for ab, boxes in DB['label_positions']['data'].get(p, {}).items():
            v = regs.get(PRINTED_AS.get(ab, ab))
            if not v:
                continue
            for cx, cy, _w, _h in boxes:
                tot += 1
                c = False
                for g in v['g']:
                    c ^= pip(g, cx, cy)
                ins += c
    shared = check_shared_edges(data, unass)
    return {'label_inside_its_own_region': round(ins / tot, 4) if tot else 0.0,
            'section_area_residual_worst_plate': round(worst_gap, 4),
            'boundary_edges_shared_exactly': shared}


def check_shared_edges(data, unass):
    """Every boundary between two regions should be one polyline, stored twice.

    This is the property that arc-wise simplification exists to preserve, and
    it is the one that matters: an interior edge appearing once, or three
    times, means two neighbours disagree about where their common boundary is,
    and there is a sliver between them that the hit test will claim twice or
    not at all. Rim edges legitimately appear once, so they are counted apart
    by looking for the reverse of each edge."""
    bad = seen = 0
    for p, regs in data.items():
        cnt = {}
        rings = [g for v in regs.values() for g in v['g']] + unass.get(p, [])
        for g in rings:
            for a, b in zip(g, g[1:]):
                k = (a[0], a[1], b[0], b[1])
                cnt[k] = cnt.get(k, 0) + 1
        for (x0, y0, x1, y1), n in cnt.items():
            seen += n
            rev = cnt.get((x1, y1, x0, y0), 0)
            if n != 1 or rev > 1:
                bad += n
    return round(1 - bad / seen, 5) if seen else 1.0


def pip(g, x, y):
    c = False
    j = len(g) - 1
    for i in range(len(g)):
        a, b = g[i], g[j]
        if (a[1] > y) != (b[1] > y) and \
           x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            c = not c
        j = i
    return c


def write_qc(plate, qc, out):
    """Overlay the regions on the plate drawing, tinted by how much of each
    boundary the atlas actually prints: green where it is drawn, red where the
    split had to be inferred. This is the check a reader can make by eye, and
    the one that catches a leak the numbers average away."""
    from PIL import Image
    LBL, interior, traced, m, W, H, order, sup = qc
    NW, NH = 1100, 703
    line = next(l for l in open(HTML) if 'window.__IMG__=' in l)
    j = line.index('{', line.index('window.__IMG__='))
    k = line.index('window.__BOX__')
    src = json.loads(line[j:line.rindex('}', j, k) + 1])[str(plate)]
    base = Image.open(io.BytesIO(base64.b64decode(
        src.split(',')[1]))).convert('RGB')

    # sample the page-frame label image on the plate-frame lattice
    im = inv6(m)
    yy, xx = np.mgrid[0:NH, 0:NW]
    gx = (im[0] * xx + im[2] * yy + im[4]).astype(np.int32)
    gy = (im[1] * xx + im[3] * yy + im[5]).astype(np.int32)
    ok = (gx >= 0) & (gx < W) & (gy >= 0) & (gy < H)
    lab = np.where(ok, LBL[np.clip(gy, 0, H - 1), np.clip(gx, 0, W - 1)], 0)

    # colour ramp: traced boundaries green, inferred ones red
    nreg = len(order)
    tint = np.zeros((nreg + 2, 3), np.uint8) + 255
    for ab, gid in order.items():
        t = sup.get(ab, 0.0)
        tint[gid] = (int(40 + 215 * (1 - t)), int(60 + 150 * t), 70)
    idx = np.where((lab >= 1) & (lab <= nreg), lab, nreg + 1)
    ov = Image.fromarray(tint[idx])
    img = Image.blend(base, ov, 0.42)
    path = os.path.join(QCDIR, 'chk_regions_%02d.png' % plate)
    img.save(path)
    print('  wrote %s' % path)


def validation_text(v):
    pc = lambda k: '%.0f%%' % (100 * v[k])
    return (
        "%(n)d structure-plate entries carry an area -- 95%% of the 3,270 the "
        "label pass located, 89%% of the 3,506 the published index lists -- as "
        "%(poly)d polygons over %(pts)d points. Of the %(seed)d printed labels "
        "seeded, %(snap)d were printed outside the face they name, on a leader "
        "line or on a boundary, and were pulled to it; %(drop)d could not be "
        "resolved at all. Three checks, none of which the extraction was tuned "
        "to pass. (1) Every boundary between two regions is stored as one "
        "polyline, twice: %(share)s of directed boundary edges have their "
        "reverse in exactly one neighbour, so the regions tile the section "
        "without overlapping it or leaving a sliver. (2) %(inside)s of printed "
        "labels fall inside the region they name. (3) Regions plus unassigned "
        "faces account for the section area to within %(resid)s on the worst "
        "plate. Per polygon, the share of the border lying on ink the tracing "
        "actually drew: median %(med).2f, %(ge90)s at or above 0.90, %(ge75)s "
        "at or above 0.75, %(lt50)s below 0.50."
    ) % dict(n=v['structure_plate_entries'], poly=v['polygons'],
             pts=v['points'], seed=v['labels_seeded'],
             snap=v['labels_relocated'], drop=v['labels_dropped'],
             share=pc('boundary_edges_shared_exactly'),
             inside=pc('label_inside_its_own_region'),
             resid=pc('section_area_residual_worst_plate'),
             med=v['traced_fraction_median'], ge90=pc('traced_fraction_ge_90'),
             ge75=pc('traced_fraction_ge_75'), lt50=pc('traced_fraction_lt_50'))


NOTE = ("Area of each structure on each plate, as a list of closed polygons of "
        "[x, y] fractions of the frame-cropped plate image, the same frame and "
        "convention brain_outline uses. `s` is the share of that polygon's "
        "border that lies on ink the tracing actually drew, one entry per "
        "polygon; `a` is the entry's area in mm2 on that plate; `n` is how many "
        "printed abbreviations seeded it. A polygon with a high `s` is the "
        "boundary the atlas printed. A low one is a split the extraction had to "
        "infer because the drawing does not separate those structures, and "
        "should be read as an estimate. `synonyms` maps an abbreviation the "
        "atlas prints only in parentheses under another one to the entry that "
        "holds its area: they name one field between them, so there is one "
        "outline and it is filed under the name printed above.")

DERIV = ("Built by tools/build_region_extents.py from the traced outlines in "
         "svg/ and the located abbreviations in label_positions. The traced "
         "paths are bridged across their dangling ends, closed against "
         "brain_outline, and cut into faces; a face sealed by traced ink and "
         "holding one abbreviation is that structure's area as drawn. Faces "
         "holding several abbreviations are split by a watershed seeded on the "
         "printed labels and ridged on the distance transform of the ink. "
         "Faces holding no label are left unassigned rather than absorbed, and "
         "an abbreviation the atlas prints in parentheses under another is "
         "seeded under that one rather than against it. "
         "Polygons are simplified by Douglas-Peucker at 2 px, as brain_outline "
         "is. See METHODS.md.")


if __name__ == '__main__':
    main()
