#!/usr/bin/env python3
"""Cut the outline of the section on each plate from the drawing.

The atlas publishes no brain surface. What it prints is a red line round the section
wherever it draws one, over a photograph of the Nissl section, with the abbreviations and
their leader lines in black on top. `brain_outline` was first taken from that page by a
gray threshold alone, which made it the photograph's edge rather than the drawing's: it
ran a pixel or six outside the red line everywhere, and it took in every printed label
and leader line touching the section. build_region_extents.py closes the tracing against
this outline, so each of those was a face sealed by no line the atlas draws -- 369 of
them over the atlas, letter-shaped where a label sat on the edge -- and they were
published as "unnamed sealed faces" and drawn in the SVG export as gray blobs hanging
off the drawing.

The rule here: **the drawn line wherever the atlas draws one along the section edge, the
tissue edge where it draws none.** The atlas does not draw the outer line everywhere --
the cerebellar flanks on plates 53 and 57, the optic nerve on plate 7 -- so an outline
from the tracing alone leaks or loses a tenth of a section, and the tissue has to be read
off the page there. Per plate:

  1. Tissue. Crop to the printed coordinate box, [14, 14, 1020, 681] of the 1100 x 703
     frame. A pixel is stain or ink where its smallest channel is under INK, as before.
     It is *not* tissue where it is neutral -- the three channels within NEUTRAL of each
     other and dark: the black of the labels, the leader lines and the frame, which the
     purple of the stain and the red of the line never are -- nor inside a printed label
     box (label_positions, padded PAD). The tracing, carried onto the plate frame, is
     in the barrier too: the drawn line runs on under a printed word where the page
     shows only black, and a pale fiber bundle sealed by it would otherwise flood with
     paper through the word. Flood the paper in from the border; what it does not
     reach is the section, holes filled, so a ventricle and a label printed inside the
     tissue both count as brain. Then the gray of a glyph's antialiased edge inside a
     printed box is taken off the solid section (stain under a word on the edge stays),
     and an opening of radius OPEN takes off one-pixel hairs; no sheet the atlas draws
     is that thin.
  2. Keep the connected components larger than max(FLOOR, SHARE of the largest), and
     any component carrying a printed label that is over FLOOR: the islands the drawing
     leaves standing clear of the section (och on 22, ML on 36) are kept by that rule
     rather than by exception.
  3. Snap to the drawing. The boundary of each component is traced, carried into the
     page frame the tracings are in, and every point within SNAP_PX of traced ink is
     moved onto the nearest ink pixel; the rest -- the open flanks -- stay on the tissue
     edge. Douglas-Peucker at DP_PX, the same tolerance region_extents is cut at, then
     back to fractions of the plate frame, DEC decimals.

The outline therefore coincides with the tracing wherever the tracing has an outer line,
so build_region_extents.py cuts no face between the two, and the section area is the
drawing's.

Reads:  data/plates/drawing/NN.jpg, svg/*.svg, data/vec.json,
        data/gerbil_atlas.json (label_positions, label_leaders, plate_frame)
Writes: data/gerbil_atlas.json (`brain_outline`), optional qc/chk_outline_NN.png

Usage:  python3 tools/build_brain_outline.py [--plates 30 | 28-33] [--qc] [--dry-run]
"""

import argparse
import os
import sys

import numpy as np
from scipy import ndimage
from skimage import measure

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                              # noqa: E402
import regiongeom as G                            # noqa: E402
import build_region_extents as B                  # noqa: E402
from atlaslib import xf, inv6                     # noqa: E402

CROP = (14, 14, 1020, 681)  # the printed coordinate box, plate px: x0, y0, x1, y1
INK = 236           # 0-255; a pixel is stain or ink below this in its smallest channel
NEUTRAL = 12        # channels within this of each other are gray, not stain or red line
DARK = 200          # ...and only where the pixel is this dark: white paper is neutral too
PAD = 1             # plate px a printed label box is widened by before it is masked
GLYPH = 24          # chroma (max - min channel) under which a pixel in a box is glyph, not stain
FLOOR = 400         # plate px; a component under this is never the section
SHARE = 0.02        # ...nor one under this share of the largest, unless it carries a label
OPEN = 1            # radius of the opening that takes off one-pixel hairs
SNAP_PX = 15        # page px (6 plate px, 0.1 mm): traced ink this near is the boundary
DP_PX = 1.25        # page px; build_region_extents.DP_PX in the frame it cuts at
DEC = 5             # fraction decimals, as brain_outline always had


# ------------------------------------------------------------------ the tissue

def tissue_mask(rgb, boxes, crop=CROP, drawn=None):
    """The section as the page shows it, glyphs and leader lines left out.

    `rgb` is the plate image as an (H, W, 3) array; `boxes` are [cx, cy, w, h]
    fractions; `drawn`, if given, is the tracing rasterized in the same frame, and
    goes into the barrier -- the drawn line runs on under a printed word, where the
    page shows only the word's black, and a pale region (a fiber bundle) sealed by that
    line would otherwise flood with paper through the word. Returns a boolean mask of
    the section, holes filled.

    The order matters. The barrier the paper is flooded against is every stained or
    red pixel and nothing else: the black of a label or a leader line is not in it,
    so a leader is paper and a label printed beside the section is paper, but the
    red line under a label printed *on* the edge is still there, and so is the
    stain behind it. Only once the section is solid are the printed boxes on its
    edge cut out of it (a box inside the tissue is a hole, and is filled back) and
    the one-pixel hairs opened off -- an opening before the flood would erode the
    line itself where white matter meets the edge, and let the paper in."""
    H, W = rgb.shape[:2]
    a = rgb.astype(np.int16)
    mn, mx = a.min(axis=2), a.max(axis=2)
    ink = mn < INK
    neutral = ((mx - mn) < NEUTRAL) & (mn < DARK)
    m = np.zeros_like(ink)
    x0, y0, x1, y1 = crop
    m[y0:y1, x0:x1] = (ink & ~neutral)[y0:y1, x0:x1]
    if drawn is not None:
        m |= drawn
    sect = ~paper_reach(m)
    for cx, cy, w, h in boxes:
        bx0 = max(0, int((cx - w / 2) * W) - PAD)
        bx1 = min(W, int((cx + w / 2) * W) + PAD + 1)
        by0 = max(0, int((cy - h / 2) * H) - PAD)
        by1 = min(H, int((cy + h / 2) * H) + PAD + 1)
        # only what is gray in the box -- the antialiased edge of a glyph -- leaves the
        # section; stain under a word printed on the edge is tissue and stays
        sect[by0:by1, bx0:bx1] &= (mx - mn)[by0:by1, bx0:bx1] >= GLYPH
    sect = ndimage.binary_fill_holes(sect)
    if OPEN:
        sect = ndimage.binary_opening(sect, structure=np.ones((2 * OPEN + 1, 2 * OPEN + 1), bool))
    return sect


def paper_reach(barrier):
    """Everything not in the barrier that the border can reach: the paper."""
    lab, _n = ndimage.label(~barrier)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    edge = edge[edge > 0]
    return np.isin(lab, edge)


def keep_components(mask, boxes):
    """Label the mask and say which components are the section.

    Returns (labels, kept ids, dropped [(id, size)]) -- dropped lists only what was
    over FLOOR, so that a reader can see what the SHARE rule took."""
    H, W = mask.shape
    lab, n = ndimage.label(mask)
    if n == 0:
        return lab, [], []
    size = np.bincount(lab.ravel(), minlength=n + 1)
    floor = max(FLOOR, SHARE * size[1:].max())
    carries = set()
    for cx, cy, _w, _h in boxes:
        xi, yi = min(W - 1, int(cx * W)), min(H - 1, int(cy * H))
        if lab[yi, xi]:
            carries.add(int(lab[yi, xi]))
    kept, dropped = [], []
    for k in range(1, n + 1):
        if size[k] >= floor or (k in carries and size[k] >= FLOOR):
            kept.append(k)
        elif size[k] >= FLOOR:
            dropped.append((k, int(size[k])))
    return lab, kept, dropped


# ---------------------------------------------------------------- the drawing

def traced_ink(plate):
    """The tracing rasterized in its own page frame, the raster the cut is made on."""
    W, H, polys = B.read_svg(os.path.join(A.SVGDIR, 'GerbilAtlas_Plate_%02d.svg' % plate))
    ink = np.zeros((H, W), bool)
    for pts, _c in polys:
        B.rasterize(ink, pts, W, H)
    return W, H, ink


def drawn_on_plate(ink, m, NW, NH):
    """The page-frame ink carried onto the plate frame, one pixel widened so that a
    line a pixel wide stays watertight across the 2.5x change of scale."""
    ys, xs = np.nonzero(ink)
    X = np.round(m[0] * xs + m[2] * ys + m[4]).astype(int)
    Y = np.round(m[1] * xs + m[3] * ys + m[5]).astype(int)
    ok = (X >= 0) & (X < NW) & (Y >= 0) & (Y < NH)
    d = np.zeros((NH, NW), bool)
    d[Y[ok], X[ok]] = True
    return ndimage.binary_dilation(d, structure=np.ones((3, 3), bool))


def snap_ring(ring_xy, m, ink_dist, ink_idx, W, H):
    """A contour in plate px -> page px, each point on the nearest ink within SNAP_PX.

    Returns (points in page px, share of points that snapped)."""
    im = inv6(m)
    out, snapped = [], 0
    for x, y in ring_xy:
        px, py = xf(im, x, y)
        xi, yi = int(round(px)), int(round(py))
        if 0 <= xi < W and 0 <= yi < H and ink_dist[yi, xi] <= SNAP_PX:
            q = (float(ink_idx[1][yi, xi]), float(ink_idx[0][yi, xi]))
            snapped += 1
        else:
            q = (px, py)
        if not out or q != out[-1]:
            out.append(q)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out, (snapped / max(1, len(ring_xy)))


def rings_of(comp, m, ink_dist, ink_idx, W, H):
    """The boundary of one component: traced, snapped, simplified. Page px."""
    rings, shares = [], []
    for c in measure.find_contours(comp.astype(np.float32), 0.5):
        if len(c) < 4:
            continue
        page, share = snap_ring([(x, y) for y, x in c], m, ink_dist, ink_idx, W, H)
        if len(page) < 3:
            continue
        keep = G.dp(page, DP_PX)
        pts = [page[i] for i in keep]
        if len(pts) > 1 and pts[0] == pts[-1]:
            pts.pop()
        rings.append(pts)
        shares.append((share, len(c)))
    return rings, shares


def build_plate(plate, DB, VECM):
    """The outline of one plate: (rings as plate fractions, stats)."""
    NW, NH = DB['plate_frame']['width_px'], DB['plate_frame']['height_px']
    rgb = np.asarray(A.plate_image('drawing', plate).convert('RGB'))
    boxes = [b for bl in A.label_boxes(DB, plate).values() for b in bl]
    m = VECM[str(plate)]
    W, H, ink = traced_ink(plate)
    mask = tissue_mask(rgb, boxes, drawn=drawn_on_plate(ink, m, NW, NH))
    lab, kept, dropped = keep_components(mask, boxes)
    ink_dist, ink_idx = ndimage.distance_transform_edt(~ink, return_indices=True)
    section = np.isin(lab, kept)
    rings_page, shares = rings_of(section, m, ink_dist, ink_idx, W, H)
    rings = []
    for pts in rings_page:
        rings.append([[round(x / NW, DEC), round(y / NH, DEC)] for x, y in (xf(m, *p) for p in pts)])
    n = sum(w for _s, w in shares) or 1
    stats = dict(rings=len(rings), area_px=int(section.sum()), dropped=dropped,
                 snapped=sum(s * w for s, w in shares) / n,
                 points=sum(len(r) for r in rings))
    return rings, stats


# -------------------------------------------------------------------- checks

def ring_area_px(rings, NW, NH):
    return sum(abs(A.poly_area([(x * NW, y * NH) for x, y in g])) for g in rings)


def labels_inside(DB, outline, plates):
    """(inside, total) printed labels whose seed -- the leader tip where the atlas draws
    one, else the box -- falls inside its plate's outline. The test's own count."""
    fr = A.Frame(DB['plate_frame'])
    inside = total = 0
    for p in plates:
        polys = [[(fr.ml_f(x), fr.dv_f(y)) for x, y in g] for g in outline.get(str(p), [])]
        tips = DB['label_leaders']['data'].get(str(p), {})
        for ab, boxes in A.label_boxes(DB, p).items():
            tip = {t[0]: (t[1], t[2]) for t in tips.get(ab, [])}
            for i, b in enumerate(boxes):
                x, y = tip.get(i, (b[0], b[1]))
                total += 1
                if any(A.pip(g, fr.ml_f(x), fr.dv_f(y)) for g in polys):
                    inside += 1
    return inside, total


def extremes(DB, outline):
    fr = A.Frame(DB['plate_frame'])
    top, bottom = -99.0, 99.0
    for gs in outline.values():
        for g in gs:
            for _x, y in g:
                dv = fr.dv_f(y)
                top, bottom = max(top, dv), min(bottom, dv)
    return top, bottom


# ------------------------------------------------------------------------ qc

def write_qc(plate, old, new, stats):
    from PIL import ImageDraw
    S = 2
    im = A.plate_image('drawing', plate).convert('RGB')
    NW, NH = im.size
    im = im.resize((NW * S, NH * S))
    dr = ImageDraw.Draw(im)
    for g in old:
        pts = [(x * NW * S, y * NH * S) for x, y in g]
        dr.line(pts + pts[:1], fill=(0, 0, 255), width=3)
    for g in new:
        pts = [(x * NW * S, y * NH * S) for x, y in g]
        dr.line(pts + pts[:1], fill=(0, 190, 0), width=2)
    dr.text((10, 10), 'plate %d  blue: before  green: this cut  rings %d  snapped %.0f%%'
            % (plate, stats['rings'], 100 * stats['snapped']), fill=(0, 0, 0))
    os.makedirs(A.QCDIR, exist_ok=True)
    path = os.path.join(A.QCDIR, 'chk_outline_%02d.png' % plate)
    im.save(path)
    return path


# ------------------------------------------------------------------- the block

NOTE = ('Outline of the section on each plate: what a track has to cross to reach a '
        'target, and the surface a depth is measured from. Keyed by plate; each entry is '
        'a list of closed polygons, and each polygon a list of [x, y] fractions of the '
        'frame-cropped plate image, read with the same two formulae as label_positions. '
        'Most plates give one polygon. Some give more, and anatomically so: the '
        'interhemispheric fissure splits plates 10-14 in two, the cortex parts from the '
        'midbrain on plates 36-42, and the cerebellum from the brainstem on plates 56-59; '
        'and two structures stand clear of the section altogether, the optic chiasm on '
        'plate 22 and the mammillary body on plate 36.')

DERIVATION = (
    'Built by tools/build_brain_outline.py from the labeled drawing and the tracing: the '
    'drawn line wherever the atlas draws one along the section edge, the tissue edge '
    'where it draws none. The plate image is cropped to the printed coordinate box, '
    '[14, 14, 1020, 681] of the 1100x703 frame; a pixel is stain or ink where its smallest '
    'channel is below %d, and is not tissue where it is neutral (channels within %d of '
    'each other and below %d: the black of the labels, the leader lines and the frame) '
    'or inside a printed label box; the paper is flooded in from the border and what it '
    'does not reach is the section, holes filled, after an opening of radius %d that '
    'takes off one-pixel hairs. Components over max(%d px, %d%% of the largest) are '
    'kept, and any component over %d px carrying a printed label, which is how the '
    'optic chiasm on plate 22 and the mammillary body on plate 36 are kept. The boundary '
    'of each is traced, carried into the page frame of svg/, and every point within %d '
    'page px of traced ink is moved onto the nearest ink pixel, so that the outline '
    'coincides with the drawing wherever the drawing has an outer line and '
    'build_region_extents.py cuts no face between the two; then Douglas-Peucker at '
    '%.2f page px (0.5 plate px, the tolerance region_extents is cut at) and back to '
    'fractions of the plate frame.' % (INK, NEUTRAL, DARK, OPEN, FLOOR, int(SHARE * 100),
                                       FLOOR, SNAP_PX, DP_PX))


def validation_text(top, bottom, inside, total, rings, snapped):
    return ('Three checks, none of which the extraction was tuned to pass. The atlas puts '
            'DV 0 at the plane through the most dorsal points of cerebrum and cerebellum, '
            'and the highest point of any outline on any plate is DV %.2f mm - the surface '
            'reaches that plane and does not cross it. The lowest is DV %.2f mm, and the '
            'deepest of the %d printed labels sits at DV -9.02, just inside it. And %.1f%% '
            'of those labels fall inside the outline of their own plate, seeded where the '
            'atlas seeds them (the end of a leader line where it draws one, else the printed '
            'word): the ones that do not are printed beside the section and pointed at, '
            'or sit on its edge. %d polygons over the 62 plates; %.1f%% of their boundary '
            'points lie on traced ink, the rest on the tissue edge where the atlas draws '
            'no outer line.' % (top, bottom, total, 100 * inside / max(1, total), rings,
                                100 * snapped))


# ----------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    A.add_plates_arg(ap)
    ap.add_argument('--qc', action='store_true', help='write qc/chk_outline_NN.png')
    ap.add_argument('--dry-run', action='store_true', help='report and write nothing')
    args = ap.parse_args()
    plates = args.plates or list(range(1, A.N_PLATES + 1))

    DB = A.load_db()
    VECM = A.vec_matrices()
    NW, NH = DB['plate_frame']['width_px'], DB['plate_frame']['height_px']
    old = DB['brain_outline']['data']
    new = {}
    tot_snap = tot_w = 0.0
    print('plate rings  area px   before    change  snapped  dropped')
    for p in plates:
        rings, st = build_plate(p, DB, VECM)
        new[str(p)] = rings
        before = ring_area_px(old.get(str(p), []), NW, NH)
        now = ring_area_px(rings, NW, NH)
        tot_snap += st['snapped'] * now
        tot_w += now
        dropped = ', '.join('%d px' % s for _k, s in st['dropped']) or '-'
        print('%5d %5d %8d %8d %+7.1f%% %7.0f%%  %s'
              % (p, st['rings'], now, before, 100 * (now - before) / max(1, before),
                 100 * st['snapped'], dropped))
        if args.qc:
            write_qc(p, old.get(str(p), []), rings, st)

    merged = dict(old)
    merged.update(new)
    inside, total = labels_inside(DB, merged, range(1, A.N_PLATES + 1))
    top, bottom = extremes(DB, merged)
    rings = sum(len(v) for v in merged.values())
    snapped = tot_snap / max(1, tot_w)
    print('\nover the atlas: %d polygons, %d points; highest DV %.2f, lowest %.2f; '
          'labels inside their outline %d of %d (%.2f%%); %.1f%% of boundary on ink'
          % (rings, sum(len(g) for v in merged.values() for g in v), top, bottom,
             inside, total, 100 * inside / max(1, total), 100 * snapped))

    if A.refuse_partial_write(args, 'brain_outline'):
        return
    DB['brain_outline'] = dict(note=NOTE, derivation=DERIVATION,
                               validation=validation_text(top, bottom, inside, total,
                                                          rings, snapped),
                               data={str(p): merged[str(p)] for p in range(1, A.N_PLATES + 1)})
    A.save_db(DB)
    print('wrote brain_outline for %d plate(s) to %s' % (len(plates), os.path.relpath(A.JSON, A.ROOT)))


if __name__ == '__main__':
    main()
