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
     ink splits the face along the strongest evidence there is. A label the
     atlas set outside its region with a line drawn back in is seeded at the
     end of that line -- see `label_leaders` and tools/label_leaders.py. Faces holding
     no label at all are left unassigned: the atlas does not name them here,
     and growing a neighbour over them would invent a claim. Abbreviations
     the atlas typeset into one label are seeded as one, not against
     each other -- see `label_blocks` and tools/label_blocks.py. And the names
     that are no region -- the fissures and sulci, the cerebellar white matter,
     the vessels; atlaslib.FEATURES -- are located and then not seeded at all,
     so the regions they were splitting keep the whole of what the atlas draws
     a boundary round. A face lettered only with one of those still takes part:
     the regions around it flood in rather than it becoming a hole.
  6. Score every polygon by the fraction of its border that lies on ink that
     was actually traced, as opposed to a ridge the watershed invented, and
     write that score out beside the geometry.
  7. Trace the boundaries on the crack lattice and simplify each shared arc
     once, at DP_PX with Douglas-Peucker as `brain_outline` already does, so
     that neighbours come out sharing their boundary exactly rather than
     approximately -- see regiongeom.py, which is where that has to be right.
     Store as fractions of the app's 1100 x 703 plate frame, the frame and
     convention brain_outline already uses.

Reads:  svg/*.svg, data/gerbil_atlas.json, the page-to-plate matrices in data/vec.json
Writes: data/gerbil_atlas.json (`region_extents`), optional qc/chk_regions_NN.png

Usage:  python3 tools/build_region_extents.py [--plates 30 | 28-33 | 5,30,45] [--qc] [--dry-run]
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
from skimage.segmentation import watershed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                              # noqa: E402
import regiongeom as G                            # noqa: E402
from atlaslib import xf, inv6, pip, poly_area     # noqa: E402

BRIDGE_PX = 20      # page px; 99% of tracing gaps are under 25, 94% under 12
DP_PX = 2.0         # plate px, as brain_outline uses: 35 um
MIN_FACE_PX = 400   # page px; below this a face is tracer noise, not a region
MIN_AREA_PX = 600   # page px; a territory smaller than this is not published
SEED_PAD = 1.0      # label box is used as the marker at this scale
SNAP_PX = 60        # a label printed beside its section is pulled this far in
TIP_SEED_PX = 4     # plate px: the mark a label on a leader line seeds with
SUPPORT_PX = 3      # a border pixel counts as drawn within this of traced ink
MIRROR_MIN = 0.5    # share of an unnamed face that must reflect into the named ones
SPLIT_ON_INK = 0.5  # below this share of a face's inner split on ink, nobody drew it
SPLIT_DRAWN = 0.75  # below this share of an entry's own border on ink, `w`
DEC = 5             # fraction decimals, matching brain_outline



# ---------------------------------------------------------------- svg reading
#
# Kept here rather than taken from atlaslib, on purpose: atlaslib.flatten cuts a
# cubic into more segments (its chord includes the p0-p3 span) and
# atlaslib.rasterize is Bresenham between integer endpoints, and the committed
# extents were cut with the two below. Either change moves boundary pixels, so
# they stay until the extents are rebuilt on purpose.

def read_svg(path):
    """Return (width, height, [polyline, ...]) for one traced plate."""
    with open(path, encoding='utf8') as f:
        txt = f.read()
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
    W, H, polys = read_svg(os.path.join(A.SVGDIR, 'GerbilAtlas_Plate_%02d.svg' % plate))
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

    # Seed each face from the printed abbreviations, except that abbreviations
    # the atlas typeset into one label -- "S1Tr/ LPtA", "Au1 (A1)" -- seed as
    # one. There is no ink between two names of one label to split on, so
    # seeding them apart makes the watershed invent a ridge and hand each a slab
    # of the other. See label_blocks and tools/label_blocks.py.
    boxes = DB['label_positions']['data'].get(str(plate), {})
    one_name = name_map(DB, plate)
    lead = DB.get('label_leaders', {}).get('data', {}).get(str(plate), {})
    seeds = np.zeros((H, W), np.int32)
    seed_ab, seed_face, snapped, dropped, led = [], [], 0, 0, 0
    printed = []                       # (ab, point, half width, half height, face)

    def place(ab, at, hw, hh, fid):
        """One seed into the raster: the glyph box where it falls inside the
        face it named, a mark on the point itself where it does not."""
        seed_ab.append(ab)
        seed_face.append(fid)
        sid = len(seed_ab)
        (ax, ay) = xf(im, (at[0] * NW - hw), (at[1] * NH - hh))
        (bx, by) = xf(im, (at[0] * NW + hw), (at[1] * NH + hh))
        x0, x1 = sorted((int(ax), int(bx)))
        y0, y1 = sorted((int(ay), int(by)))
        sl = (slice(max(0, y0), y1 + 1), slice(max(0, x0), x1 + 1))
        put = (faces[sl] == fid)
        if put.any():
            seeds[sl][put] = sid
        else:
            px, py = xf(im, at[0] * NW, at[1] * NH)
            xi, yi = int(round(px)), int(round(py))
            seeds[max(0, yi - 2):yi + 3, max(0, xi - 2):xi + 3] = sid

    for ab0, bs in boxes.items():
        ab = one_name.get(ab0, ab0)     # a joined label seeds under its first name
        tips = {i: (tx, ty) for i, tx, ty in lead.get(ab0, [])}
        for j, (cx, cy, bw, bh) in enumerate(bs):
            # A label the atlas could not fit inside its region is printed
            # outside it with a line drawn back in, and it is the end of that
            # line that says where the structure is -- see label_leaders and
            # tools/label_leaders.py. Seeding those on the word instead is not a
            # near miss: the word is on the far side of a boundary, so the seed
            # lands in a neighbour's face and the two swap territories.
            tip = tips.get(j)
            at = tip or (cx, cy)
            px, py = xf(im, at[0] * NW, at[1] * NH)
            xi, yi = int(round(px)), int(round(py))
            fid = 0
            if 0 <= xi < W and 0 <= yi < H:
                fid = faces[yi, xi]
                if fid == 0 or fsize[fid] < MIN_FACE_PX:
                    fid = 0
            if not fid:
                # printed on a wall, or beside the section with a line this pass
                # could not follow
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
            led += bool(tip)
            # the glyph box -- or, for a label on a line, a mark at the end of
            # it, because the box is somewhere else entirely
            if tip:
                hw = hh = TIP_SEED_PX
            else:
                hw, hh = bw * NW * SEED_PAD / 2, bh * NH * SEED_PAD / 2
            printed.append((ab, at, hw, hh, fid))
            place(ab, at, hw, hh, fid)

    if not seed_ab:
        return None

    mirrored = mirror_seeds(printed, place, faces, fsize, m, im, NW, NH, W, H,
                            DB['plate_frame']['ml_zero_px'])

    # Everything inside the section is up for grabs except a face the atlas
    # sealed and did not name. The drawn lines themselves belong to no face, so
    # they are in play and the watershed splits them down their middle, which
    # is where a boundary between two regions ought to fall -- leaving them out
    # would put a one-pixel no-man's-land along every boundary in the atlas.
    named = np.zeros(nfaces + 1, bool)
    named[list(set(seed_face))] = True
    # a face the drawing seals and one abbreviation names is that structure's
    # area as drawn; the rest is what the watershed below has to split
    byface, faces_of = {}, {}
    for f, nm in zip(seed_face, seed_ab):
        byface.setdefault(f, set()).add(nm)
        faces_of.setdefault(nm, set()).add(f)
    sole = sum(1 for v in byface.values() if len(v) == 1)
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

    # ---- give back the ground held by the names that are no region ----
    #
    # A fissure is the line *between* two lobules, not a lobule; `cbw` is the
    # white matter core of whichever lobule it runs through; a vessel is not
    # brain. None of them has ground of its own -- see atlaslib.FEATURES -- and
    # what they were given is the lobule's: `cbw` alone held 170 mm2 of
    # cerebellum, which left `Crus2` a wedge of its own lobule and `PM` no more
    # than its label box.
    #
    # They are seeded above all the same, and deliberately. A seed on the medial
    # axis of the white matter keeps the lobules from racing each other down it
    # -- the watershed floods the deep first, so without one there the lobule
    # whose label happens to sit deepest takes the whole arbor and the vermis
    # with it -- so the ribbons either side come out split as the drawing has
    # them. What is left is to hand that ground back, which is this: every pixel
    # of it goes to whichever region is nearest around the atlas's own ink.
    # Flat away from the lines and a step up on them, so the boundary lands on a
    # line wherever one is drawn, and past the tip of a fissure -- where the
    # atlas draws nothing, because there the two lobules really are continuous
    # -- on the midline between them, measured around everything it does draw.
    # No other boundary moves: a region's edge against another region is settled
    # above and is not replayed here.
    #
    # The step is on `wall` rather than on the traced ink, which is the same
    # network the faces were cut from: a region sealed into a face of its own
    # cannot be nearest to ground outside it, however close it lies. Ink alone
    # is not enough, because the tracing's gaps are exactly where a small
    # nucleus would leak out -- `IntDL`, the dorsolateral hump, went from its
    # drawn 0.57 mm2 to 3.68 of the medullary body through two of them. A step
    # rather than a wall, all the same: ground the atlas closes and letters only
    # with a vessel has to be reachable from the structure around it.
    fgid = [order[ab] for ab in order if ab in A.FEATURES]
    feat_mm2 = 0.0
    if fgid:
        give = np.isin(byab, fgid)
        feat_mm2 = float(give.sum())
        keep = np.where(give, 0, byab)
        byab = watershed((dist <= SUPPORT_PX).astype(np.uint8), keep,
                         mask=(keep > 0) | give)

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

    # Which faces the atlas draws nothing inside.
    #
    # A face carrying several abbreviations was split by the watershed, and that
    # split is one of two quite different things. Either the atlas does print
    # the boundary and the tracing missed it -- the two faces merged through a
    # gap, and the ridge on the distance transform found the ink again, so the
    # split sits on a line somebody drew. Or the atlas prints nothing between
    # those names at all, as it does not between a cerebellar lobule and the
    # white matter under it, and the split is the extraction's invention end to
    # end. Telling them apart by the whole outline does not work: a structure
    # can have a drawn rim and an invented inner wall. So look at the split
    # itself -- the wall the watershed put *inside* the face -- and ask how much
    # of it lands on ink the tracing drew. Below SPLIT_ON_INK nobody drew it,
    # and every entry seeded only in faces like that is marked `w`.
    fbox = ndimage.find_objects(faces, max_label=nfaces)
    invented = set()
    for f, names in byface.items():
        sl = fbox[f - 1]
        if len(names) < 2 or sl is None:
            continue
        lab = np.where(faces[sl] == f, byab[sl], 0)
        cut = np.zeros(lab.shape, bool)
        cut[:, :-1] |= (lab[:, :-1] != lab[:, 1:]) & (lab[:, :-1] > 0) & (lab[:, 1:] > 0)
        cut[:-1, :] |= (lab[:-1, :] != lab[1:, :]) & (lab[:-1, :] > 0) & (lab[1:, :] > 0)
        n = int(cut.sum())
        if n and float(near[sl][cut].sum()) / n < SPLIT_ON_INK:
            invented.add(f)
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
                   'n': sum(1 for x in seed_ab[:len(printed)] if x == ab)}

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

    # the share of each entry's own border on ink the tracing drew, area-weighted
    # over its polygons exactly as the app weights it
    supw = {ab: (sum(s_ * abs(G.ring_area([[p[0] * NW, p[1] * NH] for p in g]))
                     for s_, g in zip(v['s'], v['g'])) /
                 max(1e-9, sum(abs(G.ring_area([[p[0] * NW, p[1] * NH] for p in g]))
                               for g in v['g'])))
            for ab, v in out.items()}
    # An entry sitting only in faces the atlas draws nothing inside, and whose
    # own border is mostly that invention rather than drawn ink, has no outline
    # of its own on this plate. The `n Cb` lobules and the white matter between
    # them are the whole cerebellum; CPu, which shares a face through a gap in
    # the tracing but keeps a rim the atlas draws, is not.
    for ab, v in out.items():
        if faces_of[ab] <= invented and supw[ab] < SPLIT_DRAWN:
            v['w'] = 1

    tot_i = float(interior.sum())
    stats = dict(plate=plate, paths=len(polys), bridges=bridges,
                 faces=int((fsize[1:] >= MIN_FACE_PX).sum()),
                 seeds=len(printed), snapped=snapped, dropped=dropped,
                 mirrored=mirrored, sole=sole, led=led,
                 feat=sum(1 for pr in printed if pr[0] in A.FEATURES),
                 feat_mm2=round(feat_mm2 * mm2, 3),
                 regions=len(out),
                 split=sum(1 for v in out.values() if v.get('w')),
                 polys=sum(len(v['g']) for v in out.values()),
                 pts=sum(len(g) for v in out.values() for g in v['g']),
                 unassigned=len(unassigned),
                 covered=round(float((byab > 0).sum()) / tot_i, 4))
    return (out, unassigned, stats,
            (LBL, interior, traced, m, W, H, order, supw) if want_qc else None)


def mirror_seeds(printed, place, faces, fsize, m, im, NW, NH, W, H, ml0):
    """Seed the other hemisphere of an abbreviation the atlas prints on one side.

    Most abbreviations are printed twice, once per hemisphere, but not all of
    them: `S1J` on plate 19, `MPtA` on 28, `LPtA` on 29 are set once, and the
    face the drawing seals on the other side is then left with no name to take.
    The section is drawn symmetric about ML 0, so every printed seed is mirrored
    about it and the mirror kept only where both of these hold:

      * it lands in a face the tracing seals and no printed abbreviation names
        -- what the atlas prints in a face always wins, and nothing here can
        rename anything;
      * that face really is the mirror of the ones the seeds came from: at
        least MIRROR_MIN of it reflects into them, which a face merely opposite
        a named one does not do. The test is against all of them together,
        because the drawing need not seal the two hemispheres the same way.

    A mirrored seed is then an ordinary seed -- it takes part in the watershed
    like a printed one -- but it is not a printed label, so it is left out of
    `n` and counted separately in the summary.
    """
    held = {p[4] for p in printed}
    cand = {}
    for ab, at, hw, hh, src in printed:
        at2 = ((2 * ml0 - at[0] * NW) / NW, at[1])
        px, py = xf(im, at2[0] * NW, at2[1] * NH)
        xi, yi = int(round(px)), int(round(py))
        if not (0 <= xi < W and 0 <= yi < H):
            continue
        fid = int(faces[yi, xi])
        if not fid or fsize[fid] < MIN_FACE_PX or fid in held:
            continue
        cand.setdefault(fid, []).append((ab, at2, hw, hh, src))
    if not cand:
        return 0
    box = ndimage.find_objects(faces, max_label=int(len(fsize) - 1))
    n = 0
    for fid in sorted(cand):
        cs = cand[fid]
        if mirror_share(faces, box[fid - 1], fid,
                        {c[4] for c in cs}, m, im, NW, W, H, ml0) < MIRROR_MIN:
            continue
        for ab, at2, hw, hh, _src in cs:
            place(ab, at2, hw, hh, fid)
            n += 1
    return n


def mirror_share(faces, sl, fid, src, m, im, NW, W, H, ml0):
    """The share of face `fid` that lands inside the faces `src` when reflected
    about ML 0. Read off the raster, subsampled where a face is large: the
    answer is a share, and 20,000 pixels settle it to better than a percent.

    `src` is a set because the drawing need not seal the two hemispheres the
    same way: where the right side draws the boundary between two structures
    and the left side does not, one unnamed face answers two named ones, and
    what has to hold is that the whole of it reflects into them."""
    if sl is None:
        return 0.0
    ys, xs = np.nonzero(faces[sl] == fid)
    if not ys.size:
        return 0.0
    step = max(1, ys.size // 20000)
    ys = ys[::step] + sl[0].start
    xs = xs[::step] + sl[1].start
    px, py = xf(m, xs.astype(float), ys.astype(float))     # page -> plate frame
    qx, qy = xf(im, 2 * ml0 - px, py)                      # mirrored, and back
    qx = np.rint(qx).astype(int)
    qy = np.rint(qy).astype(int)
    ok = (qx >= 0) & (qx < W) & (qy >= 0) & (qy < H)
    if not ok.any():
        return 0.0
    hit = np.zeros(ys.size, bool)
    hit[ok] = np.isin(faces[qy[ok], qx[ok]], list(src))
    return float(hit.mean())


def name_map(DB, plate):
    """Every name of a joined label, pointing at the name the label leads with."""
    out = {}
    for g in DB.get('label_blocks', {}).get('data', {}).get(str(plate), []):
        for n in g[1:]:
            out[n] = g[0]
    return out


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

def main():
    ap = argparse.ArgumentParser()
    A.add_plates_arg(ap)
    ap.add_argument('--dry-run', action='store_true',
                    help='report only, do not touch data/gerbil_atlas.json')
    ap.add_argument('--qc', action='store_true', help='write qc/chk_regions_NN.png')
    a = ap.parse_args()

    DB = A.load_db()
    VECM = A.vec_matrices()
    plates = a.plates or [p['plate'] for p in DB['plates']]
    if a.qc:
        os.makedirs(A.QCDIR, exist_ok=True)

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
            write_qc(p, qc)
        print('plate %2d: %3d regions %4d polys %6d pts | %3d seeds '
              '(%d snapped, %d dropped, %d mirrored) | %2d unassigned | '
              '%2d split | %.0f%% covered | %d no region, %.1f mm2 back'
              % (p, st['regions'], st['polys'], st['pts'], st['seeds'],
                 st['snapped'], st['dropped'], st['mirrored'],
                 st['unassigned'], st['split'], 100 * st['covered'],
                 st['feat'], st['feat_mm2']), flush=True)

    sup = np.array([s for v in data.values() for r in v.values() for s in r['s']]
                   or [0.0])
    summary = dict(
        plates=len(rows),
        structure_plate_entries=sum(r['regions'] for r in rows),
        polygons=sum(r['polys'] for r in rows),
        points=sum(r['pts'] for r in rows),
        labels_seeded=sum(r['seeds'] for r in rows),
        faces_named_by_one_abbreviation=sum(r['sole'] for r in rows),
        labels_on_a_leader=sum(r['led'] for r in rows),
        labels_relocated=sum(r['snapped'] for r in rows),
        labels_dropped=sum(r['dropped'] for r in rows),
        labels_mirrored=sum(r['mirrored'] for r in rows),
        labels_naming_no_region=sum(r['feat'] for r in rows),
        names_that_are_no_region=len(A.FEATURES),
        mm2_returned_to_the_regions=round(sum(r['feat_mm2'] for r in rows), 1),
        entries_without_a_drawn_outline=sum(r['split'] for r in rows),
        traced_fraction_median=round(float(np.median(sup)), 3),
        traced_fraction_ge_90=round(float((sup >= .9).mean()), 3),
        traced_fraction_ge_75=round(float((sup >= .75).mean()), 3),
        traced_fraction_lt_50=round(float((sup < .5).mean()), 3),
        section_covered_mean=round(float(np.mean([r['covered'] for r in rows])), 4))
    summary.update(check_tiling(data, unass, DB))
    print('\n' + json.dumps(summary, indent=1))

    if A.refuse_partial_write(a, 'region_extents'):
        return
    write_features(DB)
    write_block(DB, dict(
        note=NOTE,
        derivation=DERIV,
        validation=validation_text(summary, DB),
        grades={'traced': 0.9, 'estimated': 0.5},
        summary=summary,
        data={p: data[p] for p in sorted(data, key=int)},
        unassigned={p: unass[p] for p in sorted(unass, key=int)}))


def write_features(DB):
    """`features` into the database, from atlaslib.FEATURES.

    It is written here rather than by a pass of its own because this is the
    script whose behaviour it is: these are the names it declines to seed. Kept
    next to `structures`, which is what it qualifies."""
    block = A.features_block()
    if DB.get('features') == block:
        return
    if 'features' in DB:
        DB['features'] = block
    else:                                       # a new block, in reading order
        items = list(DB.items())
        DB.clear()
        for k, v in items:
            DB[k] = v
            if k == 'structures':
                DB['features'] = block
    n = {}
    for kind in block['data'].values():
        n[kind] = n.get(kind, 0) + 1
    print('features: %d names the atlas draws no region for (%s)'
          % (len(block['data']),
             ', '.join('%d %s' % (v, k) for k, v in sorted(n.items()))))


def write_block(DB, block):
    """`region_extents` into the database, whole.

    The block is keyed by plate and replaced as one, which is why a run over some
    plates reports and does not write. atlaslib.render_db lays it out one compact
    line per plate, so a re-run still diffs by plate."""
    DB['region_extents'] = block
    A.save_db(DB)
    print('wrote %s (%.2f MB)' % (A.JSON, os.path.getsize(A.JSON) / 1e6))


# ------------------------------------------------------------ verification

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
        s = sum(poly_area(g) for v in regs.values() for g in v['g'])
        s += sum(poly_area(g) for g in unass.get(p, []))
        o = sum(abs(poly_area(g)) for g in DB['brain_outline']['data'][p])
        if o:
            worst_gap = max(worst_gap, abs(abs(s) - o) / o)
        lead = DB.get('label_leaders', {}).get('data', {}).get(p, {})
        for ab, boxes in DB['label_positions']['data'].get(p, {}).items():
            if ab in A.FEATURES:                # names no region, so has none to be in
                continue
            v = regs.get(name_map(DB, int(p)).get(ab, ab))
            if not v:
                continue
            # where the label says the structure is: the end of its line where
            # it draws one, the word itself where it does not
            tips = {i: (tx, ty) for i, tx, ty in lead.get(ab, [])}
            for k, (cx, cy, _w, _h) in enumerate(boxes):
                cx, cy = tips.get(k, (cx, cy))
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


def write_qc(plate, qc):
    """Overlay the regions on the plate drawing, tinted by how much of each
    boundary the atlas actually prints: green where it is drawn, red where the
    split had to be inferred. This is the check a reader can make by eye, and
    the one that catches a leak the numbers average away."""
    from PIL import Image
    LBL, _interior, _traced, m, W, H, order, sup = qc
    NW, NH = A.NW, A.NH
    base = A.plate_image('drawing', plate).convert('RGB')

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
    path = os.path.join(A.QCDIR, 'chk_regions_%02d.png' % plate)
    img.save(path)
    print('  wrote %s' % path)


def validation_text(v, DB):
    """The summary as prose. Every number in it is read off the data, the two
    denominators included: what the label pass located is the (plate, abbreviation)
    pairs in label_positions, what the index lists is the plates of every structure."""
    pc = lambda k: '%.0f%%' % (100 * v[k])
    # Both denominators leave out the names that are no region: they can never
    # carry an area, so counting them would read as a shortfall in the
    # extraction rather than as what the atlas draws.
    located = sum(1 for d in DB['label_positions']['data'].values()
                  for ab in d if ab not in A.FEATURES)
    indexed = sum(len(s['plates']) for s in DB['structures']
                  if s['abbr'] not in A.FEATURES)
    n = v['structure_plate_entries']
    return (
        "%(n)d structure-plate entries carry an area -- %(of_loc)s of the %(loc)s the "
        "label pass located, %(of_idx)s of the %(idx)s the published index lists, both "
        "counted over the structures that are regions -- as "
        "%(poly)d polygons over %(pts)d points. Of the %(seed)d printed labels "
        "seeded, %(led)d are printed outside their region with a line drawn "
        "back into it and were seeded at the end of that line rather than on "
        "the word -- see `label_leaders`. A further %(snap)d sat on a boundary, "
        "or on a line this pass could not follow, and were pulled to the "
        "largest face within a millimetre; %(drop)d could not be resolved at "
        "all. %(mir)d more seeds are not printed labels at all but mirrors of "
        "one about ML 0, filling a face the drawing seals on the hemisphere the "
        "atlas did not letter. %(feat)d of the seeds name no region at all -- the "
        "%(featn)d fissures, sulci, vessels and the cerebellar white matter that "
        "`features` lists -- and the %(fmm)s mm2 they were holding is given back "
        "at the end of the pass, each pixel of it to whichever region is nearest "
        "around the ink the atlas drew. They are seeded and then emptied rather "
        "than left out, because a seed in the depth of the white matter is what "
        "stops the lobules racing each other down it; what it must not do is "
        "keep the ground, which is the lobule's. It is why `Crus2` is its whole "
        "lobule here rather than a wedge of it. %(split)d entries carry `w`: they sit only inside "
        "boundaries the atlas draws around more than one name and prints "
        "nothing within, and most of the border stored for them is the split "
        "rather than the ink. Three checks, "
        "none of which the extraction was tuned "
        "to pass. (1) Every boundary between two regions is stored as one "
        "polyline, twice: %(share)s of directed boundary edges have their "
        "reverse in exactly one neighbour, so the regions tile the section "
        "without overlapping it or leaving a sliver. (2) %(inside)s of printed "
        "labels fall inside the region they name, read at the end of the line "
        "where the atlas draws one. (3) Regions plus unassigned "
        "faces account for the section area to within %(resid)s on the worst "
        "plate. Per polygon, the share of the border lying on ink the tracing "
        "actually drew: median %(med).2f, %(ge90)s at or above 0.90, %(ge75)s "
        "at or above 0.75, %(lt50)s below 0.50."
    ) % dict(n=n, poly=v['polygons'],
             loc='{:,}'.format(located), of_loc='%.0f%%' % (100.0 * n / max(located, 1)),
             idx='{:,}'.format(indexed), of_idx='%.0f%%' % (100.0 * n / max(indexed, 1)),
             pts=v['points'], seed=v['labels_seeded'],
             led=v['labels_on_a_leader'], snap=v['labels_relocated'],
             drop=v['labels_dropped'], mir=v['labels_mirrored'],
             feat=v['labels_naming_no_region'], featn=v['names_that_are_no_region'],
             fmm='{:,.0f}'.format(v['mm2_returned_to_the_regions']),
             split=v['entries_without_a_drawn_outline'],
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
        "should be read as an estimate. `w`, where it is present, says the entry "
        "has no outline of its own on this plate: every one of its seeds fell "
        "inside a boundary the atlas draws around more than one name and prints "
        "nothing within, and most of the border stored here is that split "
        "rather than ink. The cerebellar lobules are the largest of them; the "
        "mediodorsal thalamus and the lateral hypothalamic zones are most of "
        "the rest. Read the geometry of a `w` entry as the extraction's best "
        "guess at where one name gives way to the next, and not as a boundary "
        "to show anyone. Abbreviations the atlas typesets into one label -- see "
        "`label_blocks` -- share one entry, filed under the name the label leads "
        "with, because they name one region between them. The names that are no "
        "region -- see `features` -- have no entry here at all: a fissure is the "
        "line between two regions rather than a region, so the ground either "
        "side of it belongs to the regions it separates, and that is where it "
        "is filed.")

DERIV = ("Built by tools/build_region_extents.py from the traced outlines in "
         "svg/ and the located abbreviations in label_positions. The traced "
         "paths are bridged across their dangling ends, closed against "
         "brain_outline, and cut into faces; a face sealed by traced ink and "
         "holding one abbreviation is that structure's area as drawn. Faces "
         "holding several abbreviations are split by a watershed seeded on the "
         "printed labels and ridged on the distance transform of the ink. "
         "Abbreviations the atlas typesets into one printed label are seeded as "
         "one rather than against each other. An abbreviation the atlas prints "
         "on one hemisphere only is mirrored about ML 0 into the other, and the "
         "mirror kept where it lands in a face the drawing seals and no printed "
         "abbreviation names, and where more than half of that face reflects "
         "into the faces the mirrors came from; what is printed in a face "
         "always wins, so nothing here renames anything. Faces still holding no "
         "label are left unassigned rather than absorbed. The abbreviations "
         "`features` lists are located as every label is and then not seeded: "
         "they name a cleft, a white matter core or a vessel rather than a "
         "territory, and a face lettered only with one of them is left in play "
         "for the regions around it to flood rather than made a hole. "
         "Polygons are simplified by Douglas-Peucker at 2 px, as brain_outline "
         "is. See METHODS.md.")


if __name__ == '__main__':
    main()
