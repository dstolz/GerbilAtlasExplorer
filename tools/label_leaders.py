#!/usr/bin/env python3
"""Follow the leader line from a label to the region it actually names.

Most abbreviations are printed inside the region they name, and where they are
`label_positions` is already the answer: the box is on the structure. But the
atlas cannot always fit the word in. Where the region is small, or crowded, or
lies against the edge of the section, the name is set outside it and a thin
straight line is drawn from the word to the place it means -- `VMHSh` on plate
30 is printed clear of the brain altogether, with its line running back up into
the shell of the ventromedial nucleus.

For those labels the printed box is not where the structure is, and everything
downstream that reads the box as a position is wrong by the length of the line:
the seed `build_region_extents.py` drops (a seed on the wrong side of a boundary
hands the region to the wrong name), the stereotaxic centre the app quotes, the
point the planner aims a track at. This finds the line and records the end of it.

Nothing here reads letters either. A leader is the only thing on the page that
is all three of: ink the tracing did not draw, straight over its whole length,
and running out of a located label. So:

  1. Ink is `page < INK`, as the rest of the label pass has it, but *not* denoised:
     `denoise` wants two orthogonal neighbours and a two-pixel diagonal rule has
     none, so it deletes exactly what this is looking for.
  2. Subtract the tracing -- every line the atlas draws, from `svg/` -- and the
     printed labels: the located glyph boxes, and the gaps between words the
     atlas set as one label, so that the mark joining them goes too. What is
     left is leaders and the printed frame.
  3. Keep the connected pieces that are straight: long, thin, and elongated.
     A leader crosses the anatomy it points into, and the tracing is subtracted
     with a 2 px skirt, so one line arrives here as two or three pieces.
  4. Attach a piece to a label by running it backwards along its own direction,
     across drawn ink and across the white space the atlas leaves between a word
     and its line, until it reaches a box. Touching a box is not reaching it: the
     line has to run into the word, not stop beside it. Where two labels can each
     reach one line, the one it leaves sideways printed it -- see entry_edge.
  5. Run the same march forwards from the far end for the tip, and take that as
     the structure's position. Drop a tip that lands outside the section: a
     leader points into the brain, never out of it.
  6. Then read all 228 against the printed plate, because the shape tests cannot
     settle every one of them -- see REJECT.

Reads:  the source PDF (--pdf), svg/*.svg, data/gerbil_atlas.json, data/vec.json
Writes: data/gerbil_atlas.json (`label_leaders`); the app is rebuilt from it by
        tools/build_app.py

Usage:  python3 tools/label_leaders.py --pdf path/to/GerbilAtlas.pdf
                                       [--plates 30,31] [--dry-run] [--qc]
"""

import argparse
import math
import os
import sys

import numpy as np
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                                                 # noqa: E402
from atlaslib import NW, NH, FRAME_N, FRAME_A, to_native, from_native  # noqa: E402
from label_blocks import native, traced_mask, INK                    # noqa: E402

# Everything below is native page px at 300 dpi. The plate frame is 2.33x
# smaller, so a number here is a little under half of one there.
PAD = 2             # slop around a glyph box before it is cut out of the ink
REACH = 170         # how far from a box its line is looked for: 1.2 mm of brain
MINL = 9            # shortest piece that is a line and not a speck of halftone
WIDEMAX = 3.0       # a leader is one stroke wide; a bracket or a glyph is not
ELONG = 4.0         # length over width, which is what says "straight"
BLIND = 26          # drawn ink a march may cross without seeing its own line
SKIP = 3            # blank paper it may cross going out to the tip
BACKSKIP = 16       # ...and coming back in: the atlas leaves a word this clear
BACK = 45           # a piece further off its label than this is not its line
TIPMAX = 220        # a leader is not longer than 1.5 mm
MINTIP = 20         # a tip nearer the box than this is a bracket, not a line
JOIN_X = 15         # two words a space apart on one line are one label
JOIN_Y = 16         # ...and a block's two lines are this far apart
JOIN_PAD = 6        # a label's punctuation reaches this far past its words
DEC = 4             # fraction decimals, as label_positions already uses

# The shape tests propose and the page disposes, as the label pass itself does:
# every one of the 228 lines below was put beside the printed plate and read.
# These are the ten that were not the label's own line, with what they turned
# out to be. Nine of the ten are one failure: a line drawn past a label on its
# way somewhere else, close enough and straight enough to be that label's. There
# is no picture-level test that separates those from the real ones -- `VMHC` on
# plate 30 stops four pixels under `VMHDM` and is real -- so they are listed
# here, which is what lets a re-run reproduce the committed block and a reader
# check the judgement rather than take it.
#
# An entry is keyed (plate, abbreviation), which puts aside every impression of
# that abbreviation on the plate -- a word is printed on both hemispheres -- or
# (plate, abbreviation, index), which puts aside one of them, `index` being the
# label's position in its label_positions list, as the output keys on. None of
# the entries below needed the index; see rejected().
REJECT = {
    (8, 'Gl'): "aci's line, picked up past the stub beside Gl",
    (10, 'GrO'): "Mi's line, which ends beside GrO",
    (11, 'AOVP'): "the line VTT draws up from under the section",
    (14, '4'): "a piece of the long line E/OV draws across the bulb",
    (19, 'GI'): 'a boundary of the insular cortex the tracing missed, not a line',
    (30, 'MHb'): 'the slash of LhbL/M, whose second name is set as a suffix and '
                 'so is not a pair label_blocks records',
    (41, 'DpG'): 'a mark beside InG/Wh; DpG draws no line',
    (45, 'MNTB'): "a piece of MVPO's line, which passes MNTB on its way out",
    (46, 'MSO'): "MVPO's line, cut by the ventral border it runs along until "
                 'the only piece left starts under an over-tall MSO box',
    (47, 'MSO'): "a piece of MVPO's line, as on plate 45",
    # These three were found from the other end, by their effect. Each seeds its
    # structure inside a face another name owns, and each went unnoticed while
    # that name had no label of its own: the mis-seeded region simply held its
    # neighbour's face and looked right. When RPO, MnA and SolC were located,
    # each neighbour claimed its own ground and the mis-seeded region was left
    # with a sliver the small-area cull then removed, so ALPO, CC and pyx lost
    # their entries outright. The tip landing inside another abbreviation's
    # printed box is the tell, and it is now a test -- see tests/python.
    (44, 'ALPO'): "runs past the shell it names and ends on RPO's word, inside "
                  "the oval RPO is printed in",
    (60, 'CC'): 'CC is printed inside the canal it names and the atlas draws it '
                "no line; this is a march up the canal's own outline that ends "
                "on MnA's word",
    (62, 'pyx'): 'pyx is printed where it is, at the ventral midline, and draws '
                 "no line; this ends on SolC's word two structures away",
}


def rejected(plate, ab, index):
    """Why a label's line was put aside on reading the page, or None.

    An entry with an index applies to that impression; one without applies to all."""
    return REJECT.get((plate, ab, index)) or REJECT.get((plate, ab))


def boxdist(p, b):
    """Distance from a point to a box, zero inside it."""
    x0, y0, x1, y1 = b
    return math.hypot(max(x0 - p[0], 0, p[0] - x1), max(y0 - p[1], 0, p[1] - y1))


def entry_edge(p, b):
    """Which edge of its box a line arrives at: 0 a side, 1 the top or bottom.

    A leader is drawn out of the side of a word far more often than out from
    under it, and where two labels can each reach one line that is what settles
    which of them printed it. On plate 30 the line from `VMHC` stops four pixels
    under the last letter of `VMHDM`: read from `VMHC` it leaves a side, read
    from `VMHDM` it leaves the bottom edge three pixels shy of the corner, and
    there is nothing else to tell the two readings apart -- both are a straight
    line ending a hair off a printed name."""
    x0, y0, x1, y1 = b
    if min(abs(p[0] - x0), abs(p[0] - x1)) <= 1.0:
        return 0
    return 1


def pieces(free, x_off, y_off):
    """The straight pieces of untraced ink in one window, in page coordinates."""
    lab, _n = ndimage.label(free, structure=np.ones((3, 3)))
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None:
            continue
        ys, xs = np.nonzero(lab[sl] == i)
        if len(xs) < 6 or len(xs) > 3000:
            continue
        pts = np.stack([xs + sl[1].start + x_off, ys + sl[0].start + y_off], 1)
        pts = pts.astype(float)
        q = pts - pts.mean(0)
        _u, _s, vt = np.linalg.svd(q, full_matrices=False)
        pr, pe = q @ vt[0], q @ vt[1]
        L = pr.max() - pr.min()
        W = max(pe.max() - pe.min(), 0.7)
        if L < MINL or W > WIDEMAX or L / W < ELONG:
            continue
        out.append((tuple(pts[pr.argmin()]), tuple(pts[pr.argmax()]), L))
    return out


def march(free, tr, start, d, shape, maxlen, box=None, skipmax=SKIP):
    """Step along d from start, following the line. Returns (last ink, hit box).

    Drawn ink is transparent -- a leader crosses the boundaries it points over,
    and the tracing has been cut out from under it -- and so is a short run of
    white, which is the gap the atlas leaves between a word and its line. Any
    longer run of either ends the line."""
    H, W = shape
    start = np.asarray(start, float)
    last, blind, skip = start, 0, 0
    for t in range(1, maxlen + 1):
        p = start + d * t
        xi, yi = int(round(p[0])), int(round(p[1]))
        if not (1 <= xi < W - 1 and 1 <= yi < H - 1):
            break
        if box is not None and boxdist(p, box) <= 1.0:
            return p, True
        if free[yi - 1:yi + 2, xi - 1:xi + 2].any():
            last, blind, skip = p, 0, 0
        elif tr[yi, xi]:
            blind += 1
            if blind > BLIND:
                break
        else:
            skip += 1
            if skip > skipmax:
                break
    return last, False


def leaders(page, tr, boxes, blocks=()):
    """Every located label on one plate that has a line, and where it points."""
    shape = page.shape
    H, W = shape
    occ = np.zeros(shape, bool)
    for x0, y0, x1, y1 in [b[1:] for b in boxes] + list(blocks):
        occ[max(0, int(y0) - PAD):int(y1) + 1 + PAD,
            max(0, int(x0) - PAD):int(x1) + 1 + PAD] = True
    free = (page < INK) & ~tr & ~occ

    # A piece is one line's, not one label's: two labels can each reach it and
    # only one of them printed it, so the claims are collected against the piece
    # and settled once, on which end arrives at the side of a word.
    claim = {}
    for k, (_ab, x0, y0, x1, y1) in enumerate(boxes):
        b = (x0, y0, x1, y1)
        wy0, wy1 = max(0, int(y0) - REACH), min(H, int(y1) + REACH)
        wx0, wx1 = max(0, int(x0) - REACH), min(W, int(x1) + REACH)
        for e0, e1, L in pieces(free[wy0:wy1, wx0:wx1], wx0, wy0):
            for near, far in ((e0, e1), (e1, e0)):
                near, far = np.array(near), np.array(far)
                dn = boxdist(near, b)
                if boxdist(far, b) <= dn + MINL * 0.5:
                    continue                      # not pointing away from it
                d = far - near
                d /= np.linalg.norm(d)
                # Run it back along itself and see whether it arrives at the
                # word. Touching the box is not arriving at it: on plate 46 the
                # line `MVPO` draws up into its own nucleus ends one pixel off
                # the right edge of `MSO`, pointing away from it -- read
                # backwards from that end it goes further away still, and read
                # backwards from the other it runs down into the word `MVPO`.
                at, hit = march(free, tr, near, -d, shape,
                                min(BACK, int(dn) + 6), b, BACKSKIP)
                if not hit:
                    continue
                rank = (entry_edge(at, b), dn)
                if (e0, e1) not in claim or rank < claim[(e0, e1)][0]:
                    claim[(e0, e1)] = (rank, k, near, far, L)

    best = {}
    for (_rank, k, near, far, L) in claim.values():
        if k not in best or L > best[k][2]:
            best[k] = (near, far, L)

    out = []
    for k, (near, far, L) in sorted(best.items()):
        d = far - near
        d /= np.linalg.norm(d)
        tip, _hit = march(free, tr, far, d, shape, TIPMAX)
        ab, x0, y0, x1, y1 = boxes[k]
        b = (x0, y0, x1, y1)
        if boxdist(tip, b) < MINTIP:
            continue
        out.append(dict(i=k, ab=ab, box=b, near=near, tip=tip, L=L,
                        reach=boxdist(tip, b)))
    return out, free


# ------------------------------------------------------------------ the plate

def plate_boxes(DB, plate):
    """Every located label on one plate as a box in the native page frame.

    Carries the index into `label_positions`, which is what the output keys on:
    a structure is printed twice on most plates and only one of the two can have
    a line."""
    boxes, idx = [], []
    for ab, bs in sorted(DB['label_positions']['data'].get(str(plate), {}).items()):
        for j, (cx, cy, bw, bh) in enumerate(bs):
            x0, y0 = to_native((cx - bw / 2) * NW, (cy - bh / 2) * NH)
            x1, y1 = to_native((cx + bw / 2) * NW, (cy + bh / 2) * NH)
            boxes.append((ab, x0, y0, x1, y1))
            idx.append((ab, j))
    return boxes, idx


def joined(DB, plate, boxes):
    """The gaps between words the atlas set as one printed label.

    `label_positions` boxes the words; the atlas also prints what joins them --
    the slash of `Cg1/ RSD` or of `LhbL/M`, the brackets of `Au1 (A1/AAF)` --
    and those marks are ink the tracing did not draw, straight, and running out
    of a located box, which is every property this reads a leader by. They are
    not leaders: they are the punctuation of one label, and the region they
    would point into is the next word.

    So the gap goes out of the ink along with the words. Two words a space apart
    on one line are one label whatever `label_blocks` says of them: no two
    separate names are set that close, and `LhbL/M` -- whose second name is a
    suffix, so not a pair `label_blocks` could read -- puts its slash under
    `Mhb` on plate 30 exactly as `Cg1/ RSD` puts one under `RSD`. Stacked words
    are the other way round: a column of names one line apart is the ordinary
    way the atlas lists several regions, and only `label_blocks` can say which
    of those columns is one label being read down."""
    out = []
    for i, (_a, ax0, ay0, ax1, ay1) in enumerate(boxes):
        for _b, bx0, by0, bx1, by1 in boxes[i + 1:]:
            if max(ax0 - bx1, bx0 - ax1, 0) > JOIN_X or ay1 < by0 or by1 < ay0:
                continue
            out.append((min(ax0, bx0) - JOIN_PAD, min(ay0, by0) - JOIN_PAD,
                        max(ax1, bx1) + JOIN_PAD, max(ay1, by1) + JOIN_PAD))
    LP = DB['label_positions']['data'].get(str(plate), {})
    for group in DB.get('label_blocks', {}).get('data', {}).get(str(plate), []):
        got = []
        for ab in group:
            for cx, cy, bw, bh in LP.get(ab, []):
                x0, y0 = to_native((cx - bw / 2) * NW, (cy - bh / 2) * NH)
                x1, y1 = to_native((cx + bw / 2) * NW, (cy + bh / 2) * NH)
                got.append((x0, y0, x1, y1))
        for i, a in enumerate(got):
            for b in got[i + 1:]:
                if (max(a[0] - b[2], b[0] - a[2], 0) <= JOIN_X
                        and max(a[1] - b[3], b[1] - a[3], 0) <= JOIN_Y):
                    out.append((min(a[0], b[0]) - JOIN_PAD, min(a[1], b[1]) - JOIN_PAD,
                                max(a[2], b[2]) + JOIN_PAD, max(a[3], b[3]) + JOIN_PAD))
    return out


# plate px per native page px, along each axis
PX = ((FRAME_A[2] - FRAME_A[0]) / (FRAME_N[2] - FRAME_N[0]),
      (FRAME_A[3] - FRAME_A[1]) / (FRAME_N[3] - FRAME_N[1]))


def inside(polys, x, y):
    """Is a plate-frame fraction inside the published section outline?

    Even-odd, as brain_outline's own note has it: a plate may give more than one
    closed polygon and they do not nest."""
    hit = False
    for poly in polys:
        n = len(poly)
        for i in range(n):
            ax, ay = poly[i]
            bx, by = poly[(i + 1) % n]
            if (ay > y) != (by > y) and x < ax + (y - ay) / (by - ay) * (bx - ax):
                hit = not hit
    return hit


# ------------------------------------------------------------------------- qc

def qc_draw(page, boxes, out, path):
    """The plate at half size, every box outlined and every line drawn to its tip.

    Half the page, and paletted: the halftone ground is most of what a
    full-resolution PNG of this would store and none of it is what a reader is
    checking. The palette is built rather than quantised for -- an adaptive one
    over a page of greys throws the three marks away, which are the whole point.
    A leader is still a line and its tip is still a dot at 150 dpi."""
    from PIL import Image
    H, W = page.shape
    q = np.asarray(Image.fromarray(page.astype(np.uint8))
                   .resize((W // 2, H // 2), Image.LANCZOS)) // 4
    pal = [(g * 4, g * 4, g * 4) for g in range(64)]
    BOX, LINE, TIP = 64, 65, 66
    pal += [(0, 110, 255), (220, 0, 0), (0, 160, 0)]
    h, w = q.shape
    put = lambda y, x, c: q.__setitem__(
        (slice(max(0, int(y)), min(h, int(y) + 1)),
         slice(max(0, int(x)), min(w, int(x) + 1))), c)
    for _ab, x0, y0, x1, y1 in boxes:
        for t in range(int(y0 / 2), int(y1 / 2) + 1):
            put(t, x0 / 2, BOX)
            put(t, x1 / 2, BOX)
        for t in range(int(x0 / 2), int(x1 / 2) + 1):
            put(y0 / 2, t, BOX)
            put(y1 / 2, t, BOX)
    for o in out:
        a = np.array([(o['box'][0] + o['box'][2]) / 4,
                      (o['box'][1] + o['box'][3]) / 4])
        e = np.asarray(o['tip']) / 2
        v = e - a
        n = int(max(abs(v[0]), abs(v[1]))) + 1
        for t in range(n + 1):
            c = a + v * t / n
            put(c[1], c[0], LINE)
        q[max(0, int(e[1]) - 2):int(e[1]) + 3,
          max(0, int(e[0]) - 2):int(e[0]) + 3] = TIP
    im = Image.fromarray(q.astype(np.uint8), 'P')
    im.putpalette([v for c in pal for v in c] + [0] * (3 * (256 - len(pal))))
    im.save(path, optimize=True)
    print('   wrote %s' % os.path.relpath(path, A.ROOT))


# ----------------------------------------------------------------------- main

NOTE = ("Where the atlas prints an abbreviation outside the region it names and "
        "draws a line to it, this is the far end of that line: the position the "
        "label means, as [i, x, y], where i indexes that abbreviation's list in "
        "label_positions on the same plate and x, y are fractions of the "
        "frame-cropped plate image, the frame plate_frame calibrates. The box "
        "in label_positions is still where the word is printed and is still "
        "what a reader hovers; this is where it points. Labels without a line "
        "are absent: for those the box is the position.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf', default=os.environ.get('GERBIL_ATLAS_PDF', ''),
                    help='the published atlas PDF; or set GERBIL_ATLAS_PDF')
    A.add_plates_arg(ap)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--qc', action='store_true',
                    help='write qc/chk_leader_NN.png per plate')
    a = ap.parse_args()
    if not a.pdf:
        raise SystemExit('--pdf is required: this reads the printed page, not the '
                         "app's downsampled copy. See the module docstring.")

    import pymupdf
    DB = A.load_db()
    doc = pymupdf.open(a.pdf)
    VECM = A.vec_matrices()
    if a.qc:
        os.makedirs(A.QCDIR, exist_ok=True)

    want = a.plates or list(range(1, A.N_PLATES + 1))
    outline = {int(p): v for p, v in DB['brain_outline']['data'].items()}

    data, rows = {}, []
    for p in want:
        boxes, idx = plate_boxes(DB, p)
        if not boxes:
            continue
        page = np.asarray(native(doc, p))
        tr = traced_mask(p, VECM, page.shape)
        if tr is None:
            print('plate %d: no tracing, skipped' % p)
            continue
        found, _free = leaders(page, tr, boxes, joined(DB, p, boxes))
        keep, off, cut = [], 0, 0
        for o in found:
            ab, j = idx[o['i']]
            if rejected(p, ab, j):
                cut += 1
                continue
            x, y = from_native(*o['tip'])
            fx, fy = x / NW, y / NH
            if not inside(outline.get(p, []), fx, fy):
                off += 1                          # a line points into the brain
                continue
            keep.append((ab, j, round(fx, DEC), round(fy, DEC), o['reach']))
        if keep:
            d = {}
            for ab, j, fx, fy, _r in keep:
                d.setdefault(ab, []).append([j, fx, fy])
            data[str(p)] = {k: sorted(v) for k, v in sorted(d.items())}
        rows.append((p, len(boxes), len(keep), off, cut,
                     [r for *_x, r in keep]))
        print('plate %2d: %3d labels %3d leaders%s%s  %s'
              % (p, len(boxes), len(keep),
                 (' (%d off-section)' % off) if off else '',
                 (' (%d read against the page and rejected)' % cut) if cut else '',
                 ' '.join(sorted({ab for ab, *_ in keep}))))
        if a.qc:
            qc_draw(page, boxes, [o for o in found if not rejected(p, *idx[o['i']])],
                    os.path.join(A.QCDIR, 'chk_leader_%02d.png' % p))

    summary = report(rows, DB)
    if A.refuse_partial_write(a, 'label_leaders'):
        return
    write_block(DB, data, summary)


def report(rows, DB):
    # a leader's length is quoted where a reader can judge it: millimetres of
    # brain, by way of the plate frame the whole database is calibrated in
    mm = lambda px: px * PX[0] / DB['plate_frame']['ml_px_per_mm']
    n_lead = sum(r[2] for r in rows)
    reach = sorted(r for row in rows for r in row[5])
    s = {'plates': len(rows),
         'labels_read': sum(r[1] for r in rows),
         'leaders_found': n_lead,
         'tips_off_section_dropped': sum(r[3] for r in rows),
         'rejected_against_the_page': sum(r[4] for r in rows),
         'leader_length_median_mm': round(mm(float(np.median(reach))), 3) if reach else 0,
         'leader_length_max_mm': round(mm(max(reach)), 3) if reach else 0}
    print('\n%d leaders on %d labels over %d plates; median %.2f mm, longest %.2f mm'
          % (n_lead, s['labels_read'], s['plates'],
             s['leader_length_median_mm'], s['leader_length_max_mm']))
    return s


def write_block(DB, data, summary):
    """`label_leaders` into the database: the note, the summary, and one line per
    plate that carries a leader (atlaslib.render_db lays the block out that way).
    The app's copy is rebuilt from it by tools/build_app.py."""
    DB['label_leaders'] = {'note': NOTE, 'summary': summary,
                           'data': {p: data[p] for p in sorted(data, key=int)}}
    A.save_db(DB)
    print('wrote %s' % A.JSON)


if __name__ == '__main__':
    main()
