#!/usr/bin/env python3
"""Which printed abbreviations are one label, and so name one region between them.

`label_positions` locates abbreviations. It does not say which of them the atlas
typeset together, and on this atlas that matters, because a face is often named
by two abbreviations joined into one label, over one line or two --

    S1Tr/          Au1          Au1
    LPtA           (A1)         (A1/AAF)

Seeded as rivals they are worse than useless. There is no ink between them to
split on, so the watershed in build_region_extents.py invents a ridge down the
middle of the face and hands each name a slab of the other's territory -- which
is how `A1` came to be a rectangle across primary auditory cortex rather than
the field itself.

What joins them is punctuation, so punctuation is what this reads, and it reads
it in the one place it can be isolated: `label_positions` already says which
pixels are letters, so **the ink on a line that no box claims is the
punctuation**, segmented rather than guessed at. Each such slice is classified by
the path its ink takes down the line --

    /   as tall as the line, narrow, and straight along a steady lean
    ( ) as tall as the line, narrow, straight up, and bowed -- the extreme
        column at the vertical middle with both ends falling back

-- which is also what tells a bracket from an `l`, a `1` or an `I`.

Then: a line is a parenthetical if a `(` leads it and a `)` ends it, and it is
continued if a `/` ends it. Either way it belongs to the line above, and every
name on it names what that label names. A `/` between two boxes on one line
joins those two.

**Read at native resolution, off the source PDF.** In the app's 1100 x 703 plate
frame a glyph is 8 px tall, its letters run together, and a bracket cannot be
told from an `l`. The published pages carry the same plate at 2558 x 1708 -- 2.5x,
a 20 px glyph, letters cleanly apart -- which is the same source, and the same
reason the label pass itself was run there. See METHODS.

Reads:  the source PDF (--pdf), data/gerbil_atlas.json, svg/*.svg, data/vec.json
Writes: data/gerbil_atlas.json (`label_blocks`), optional qc/chk_blocks_NN.png

Usage:  python3 tools/label_blocks.py --pdf path/to/GerbilAtlas4Analysis.pdf
                                      [--qc] [--dry-run]
"""

import argparse
import io
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                                           # noqa: E402
# the printed axes frame, in native page px and in the app's plate px, and the map
# between them; re-exported here because label_leaders.py and
# find_missing_labels.py read them from this module
from atlaslib import FRAME_N, FRAME_A, to_native               # noqa: E402,F401

INK = 110       # 0-255; line art over a speckled halftone ground
SEEK = 2        # native px a mapped box may be nudged to seat on its own ink
RUN = 2         # columns of white that separate one glyph from the next
ROW = 7         # native px of baseline scatter that is still the same line
GAP = 7         # columns of white still inside one printed word
REACH = 40      # native px looked along a line for punctuation past the letters
WIDE = 9        # a mark is at most this many columns wide
FULL = 0.85     # a mark leading or ending a line is this tall, against the line
PART = 0.45     # ...but one wedged between two letters may be half claimed
STRAIGHT = 0.55 # px RMS off a straight line: how straight a slash has to be
LEAN = 0.22     # px of column per row: how much a slash has to lean
BOW = 1.0       # px: how far a bracket's middle stands out from its ends
NEXT = 1.9      # line pitch, in line heights, that still counts as the next line
SIDE = 0.50     # share of the narrower line that two lines must overlap in x
ONLINE = 0.35   # share of a stroke lying on a traced path that makes it one
ALIGN = 12      # native px: how nearly a wrapped line starts under its first
WIDEN = 2       # native px the traced paths are thickened by before that test


# One label the read cannot reach, and why. On plate 49 the slash of "PM/ Cop"
# is drawn along the very boundary it names, so the tracing runs down it and the
# test below cannot tell the mark from the line -- at every threshold that keeps
# this one, two boundaries elsewhere come through as slashes. It is printed
# plainly on the page, it was read by eye during review, and it is added here so
# that a re-run reproduces the committed block exactly rather than quietly
# dropping it. Nothing else on the 62 plates needed this.
ALSO = {49: [['PM', 'Cop']]}


# ---------------------------------------------------------------- the tracings

def traced_mask(plate, VECM, shape_, cache={}):
    """Every line the atlas draws on this plate, in the native page frame.

    svg/ holds them in the frame they were traced in; the matrices in
    data/vec.json (atlaslib.vec_matrices) carry that onto the app's plate frame,
    and to_native carries it on to this one. Each cubic is cut into twelve, as
    it always was here."""
    if plate in cache:
        return cache[plate]
    if not os.path.exists(os.path.join(A.SVGDIR, 'GerbilAtlas_Plate_%02d.svg' % plate)):
        return None
    m = VECM[str(plate)]
    mask = np.zeros(shape_, bool)
    for d, _sw, _gid in A.read_svg(plate):
        pts = [p for sub, _closed in A.flatten(d, seg=12) for p in sub]
        if len(pts) < 2:
            continue
        q = [to_native(*A.xf(m, x, y)) for x, y in pts]
        draw(mask, q)
    if WIDEN:
        k = WIDEN
        acc = mask.copy()
        for dy in range(-k, k + 1):
            for dx in range(-k, k + 1):
                acc |= np.roll(np.roll(mask, dy, 0), dx, 1)
        mask = acc
    cache.clear()
    cache[plate] = mask
    return mask


def draw(mask, pts):
    """A polyline into a mask, one pixel per step of its longer axis.

    Not atlaslib.rasterize: that is Bresenham between integer endpoints, and the
    committed blocks were read against a mask drawn this way."""
    H, W = mask.shape
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for k in range(n + 1):
            t = k / n
            xi, yi = int(round(x0 + (x1 - x0) * t)), int(round(y0 + (y1 - y0) * t))
            if 0 <= xi < W and 0 <= yi < H:
                mask[yi, xi] = True


# ------------------------------------------------------------------- the page

def native(doc, plate):
    """One plate at the resolution it was printed.

    The page holds exactly one embedded image; extracting it is lossless, where
    rendering the page would resample and cost exactly the detail this reads."""
    xref = doc[plate - 1].get_images(full=True)[0][0]
    im = Image.open(io.BytesIO(doc.extract_image(xref)['image']))
    return im.rotate(-90, expand=True).convert('L')


def denoise(ink):
    """Drop single speckles of the halftone ground and keep every stroke.

    A glyph stroke is two or more pixels wide here, so a pixel with fewer than
    two orthogonal neighbours is ground."""
    n = np.zeros(ink.shape, np.uint8)
    n[1:] += ink[:-1]
    n[:-1] += ink[1:]
    n[:, 1:] += ink[:, :-1]
    n[:, :-1] += ink[:, 1:]
    return ink & (n >= 2)


def seat(ink, box):
    """Nudge a mapped box onto the ink it names.

    The frame is published to half a pixel and two of the 62 pages are laid out
    a pixel or two off it. Every slice below is cut at a box edge, so that pixel
    is worth recovering -- but only that pixel: given room to roam, a box over
    `AAF` slides left onto the `(` of `(AAF)`, swallows the very mark being
    looked for, and reports the label unbracketed. Hence SEEK of 2."""
    x0, y0, x1, y1 = box
    best, keep = -1.0, (0, 0)
    for dy in range(-SEEK, SEEK + 1):
        for dx in range(-SEEK, SEEK + 1):
            s = float(ink[max(0, y0 + dy):y1 + dy, max(0, x0 + dx):x1 + dx].sum())
            s -= 0.001 * (abs(dx) + abs(dy))
            if s > best:
                best, keep = s, (dx, dy)
    dx, dy = keep
    return (x0 + dx, y0 + dy, x1 + dx, y1 + dy)


# -------------------------------------------------------------- the punctuation

def mark(ink, boxes, y0, y1, x0, x1, anchor, tall, part=False, traced=None):
    """Classify the ink in one gap of a printed line as '/', '(', ')' or None.

    The gap is split into glyphs and each is offered in turn, nearest the
    letters first, because a box edge does not always fall cleanly between two
    glyphs: the slice after `A1` in `(A1)` can hold the last column of the `1`
    as well as the `)`, and read whole it is neither. `anchor` is the side the
    gap is entered from, so the search runs outwards from the letters."""
    x0, x1 = max(0, x0), min(ink.shape[1], x1)
    if x1 <= x0:
        return None
    sub = ink[max(0, y0):y1, x0:x1].copy()
    for b in boxes:                       # never read a letter as punctuation
        a, c = max(x0, b[0]) - x0, min(x1, b[2]) - x0
        if c > a:
            sub[:, a:c] = False
    cols = np.where(sub.any(axis=0))[0]
    if not len(cols):
        return None
    groups, g = [], [cols[0]]
    for c in cols[1:]:
        if c - g[-1] <= RUN:
            g.append(c)
        else:
            groups.append(g)
            g = [c]
    groups.append(g)
    if anchor > 0:
        groups.sort(key=lambda q: q[0])
    else:
        groups.sort(key=lambda q: -q[-1])
    for g in groups:
        near = g[0] if anchor > 0 else (x1 - x0 - 1 - g[-1])
        if near > GAP + 2:                # detached: belongs to something else
            break
        m = shape(ink, sub, g, x0, y0, y1, tall, part, traced)
        if m:
            return m
    return None


def shape(ink, sub, g, x0, y0, y1, tall, part, traced=None):
    """What one candidate stroke is, by its width, its height and its path."""
    if g[-1] - g[0] + 1 > WIDE:
        return None
    s = sub[:, g[0]:g[-1] + 1]
    rows = np.where(s.any(axis=1))[0]
    if len(rows) < 8:
        return None
    h = rows[-1] - rows[0] + 1
    if h < (PART if part else FULL) * tall:
        return None
    col = np.array([np.where(s[r])[0].mean() for r in rows])
    n = len(col)
    t = np.arange(n)
    fit = np.polyfit(t, col, 1)
    lean = float(fit[0])
    res = float(np.sqrt(np.mean((col - np.polyval(fit, t)) ** 2)))

    # A drawn boundary runs through a label at any angle and is as thin and as
    # straight as a slash, so shape alone cannot tell them apart -- and every
    # rule of thumb tried here either kept a boundary or lost a real slash. It
    # does not have to: the boundaries are already vectorised in svg/, so a
    # candidate sitting on a traced path is a boundary, said and not guessed.
    if traced is not None:
        hit = (traced[max(0, y0):y1, x0 + g[0]:x0 + g[-1] + 1][s].mean()
               if s.any() else 0.0)
        if hit > ONLINE:
            return None

    if lean <= -LEAN and res <= STRAIGHT:
        return '/'                        # a steady lean, and straight along it
    if abs(lean) > LEAN:
        return None
    k = max(1, n // 4)
    bow = float(np.mean(col[n // 3:2 * n // 3 + 1]) -
                np.mean(np.r_[col[:k], col[-k:]]))
    if bow <= -BOW:
        return '('
    if bow >= BOW:
        return ')'
    return None


def lines_of(boxes):
    """The located boxes of one plate, gathered into printed lines.

    Same baseline and close enough along it to be the same run of type. Walked
    left to right so the test is against the line's right edge only -- the same
    row on the other hemisphere is the same baseline and must not join."""
    out = []
    for key in sorted(boxes, key=lambda k: (boxes[k][1], boxes[k][0])):
        b = boxes[key]
        for ln in out:
            c = boxes[ln[0]]
            right = max(boxes[k][2] for k in ln)
            if abs(c[1] - b[1]) < ROW and abs(c[3] - b[3]) < ROW and \
                    -GAP <= b[0] - right < REACH:
                ln.append(key)
                break
        else:
            out.append([key])
    return [sorted(ln, key=lambda k: boxes[k][0]) for ln in out]


def punctuate(ink, boxes, line, traced=None):
    """What leads a line, what ends it, and what stands between its boxes.

    Only the letters *on this line* are masked out. A label one line down often
    overlaps the column a mark stands in -- "S1Tr/" over "LPtA" is exactly that
    -- and masking it would erase the very stroke being read."""
    bs = [boxes[k] for k in line]
    y0, y1 = min(b[1] for b in bs) - 5, max(b[3] for b in bs) + 6
    tall = max(b[3] - b[1] for b in bs)
    mid = (min(b[1] for b in bs) + max(b[3] for b in bs)) / 2
    here = [b for b in boxes.values() if b[1] <= mid <= b[3]]
    lead = mark(ink, here, y0, y1, bs[0][0] - REACH, bs[0][0], -1, tall,
                traced=traced)
    tail = mark(ink, here, y0, y1, bs[-1][2], bs[-1][2] + REACH, +1, tall,
                traced=traced)
    sep = [mark(ink, here, y0, y1, bs[i][2], bs[i + 1][0], +1, tall,
                part=True, traced=traced)
           for i in range(len(bs) - 1)]
    return lead, tail, sep, (y0, y1, bs[0][0], bs[-1][2])


# ----------------------------------------------------------------- the grouping

def blocks(ink, boxes, traced=None):
    """Group one plate's boxes into printed labels, by union-find over the marks.

    Each join is the typesetter's, not a guess about anatomy: a slash between two
    names, a slash continuing a line onto the next, or a bracket around a line
    that then belongs to the one above it."""
    up = {k: k for k in boxes}

    def find(k):
        while up[k] != k:
            up[k] = up[up[k]]
            k = up[k]
        return k

    def join(p, q):
        p, q = find(p), find(q)
        if p != q:
            up[p] = q

    lines = lines_of(boxes)
    info = [punctuate(ink, boxes, ln, traced) for ln in lines]
    for ln, (_lead, _tail, sep, _span) in zip(lines, info):
        for i, m in enumerate(sep):
            if m == '/':
                join(ln[i], ln[i + 1])
    for i, (ln, (lead, tail, _sep, span)) in enumerate(zip(lines, info)):
        bracketed = lead == '(' and tail == ')'
        for j, (up_ln, (_l, up_tail, _s, up_span)) in enumerate(zip(lines, info)):
            if j == i:
                continue
            # A line continued by a slash is a wrapped line, and a wrapped line
            # starts where the line above it started. Without that, an `E/OV`
            # whose `OV` the line grouping missed reaches down and claims the
            # `AOE` printed under it, which is a different label on a leader.
            runs_on = (up_tail == '/'
                       and abs(span[2] - up_span[2]) <= ALIGN)
            if not (runs_on or bracketed):
                continue
            hi, lo = boxes[up_ln[0]][1], boxes[ln[0]][1]
            h = max(1, boxes[up_ln[0]][3] - hi)
            if not 0 < lo - hi <= NEXT * h:
                continue
            if (min(span[3], up_span[3]) - max(span[2], up_span[2])
                    < SIDE * min(span[3] - span[2], up_span[3] - up_span[2])):
                continue
            # Only the boxes actually standing under one another. A line can
            # carry a second label further along it -- "CG2/ RSGc" with a `cg`
            # printed beside it -- and that one is not part of this label.
            for a in ln:
                for b in up_ln:
                    if min(boxes[a][2], boxes[b][2]) > max(boxes[a][0], boxes[b][0]):
                        join(a, b)

    grp = {}
    for k in boxes:
        grp.setdefault(find(k), []).append(k)
    return [v for v in grp.values() if len(v) > 1], lines, info


# ------------------------------------------------------------------------ main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf', default=os.environ.get('GERBIL_ATLAS_PDF', ''),
                    help='the source PDF; or set GERBIL_ATLAS_PDF')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--qc', action='store_true',
                    help='write qc/chk_blocks_NN.png for each plate with a block')
    a = ap.parse_args()
    if not a.pdf:
        raise SystemExit('--pdf is required: this reads the printed page, not the '
                         "app's downsampled copy. See the module docstring.")
    import pymupdf
    doc = pymupdf.open(a.pdf)
    VECM = A.vec_matrices()

    DB = A.load_db()
    NW = DB['plate_frame']['width_px']
    NH = DB['plate_frame']['height_px']
    LP = DB['label_positions']['data']
    if a.qc:
        os.makedirs(A.QCDIR, exist_ok=True)

    out, found = {}, []
    for p in sorted(LP, key=int):
        im = native(doc, int(p))
        ink = denoise(np.asarray(im) < INK)
        boxes = {}
        for ab, bs in LP[p].items():
            for k, (cx, cy, bw, bh) in enumerate(bs):
                x0, y0 = to_native((cx - bw / 2) * NW, (cy - bh / 2) * NH)
                x1, y1 = to_native((cx + bw / 2) * NW, (cy + bh / 2) * NH)
                boxes[(ab, k)] = seat(ink, (int(round(x0)), int(round(y0)),
                                            int(round(x1)), int(round(y1))))
        bl, _lines, _info = blocks(ink, boxes, traced_mask(int(p), VECM, ink.shape))
        # Reduce to names. The same label is printed on both hemispheres, and a
        # mark can be clearer on one than the other, so a join read anywhere on
        # the plate is a join everywhere on it -- otherwise one hemisphere would
        # carry the group and the other a fragment of it.
        seen, order = {}, []
        for g in sorted(bl, key=lambda g: min(boxes[k][1] for k in g)):
            g = sorted(g, key=lambda k: (boxes[k][1], boxes[k][0]))
            nm = list(dict.fromkeys(k[0] for k in g))
            if len(nm) < 2:
                continue
            head = next((seen[n] for n in nm if n in seen), None)
            if head is None:
                head = len(order)
                order.append([])
            for n in nm:
                if n not in seen:
                    seen[n] = head
                    order[head].append(n)
                elif seen[n] != head:                     # fold the two together
                    old = seen[n]
                    for m in order[old]:
                        seen[m] = head
                        if m not in order[head]:
                            order[head].append(m)
                    order[old] = []
        names = [g for g in order if len(g) > 1]
        for g in names:
            found.append((int(p), tuple(g)))
        for extra in ALSO.get(int(p), []):
            if all(n in LP[p] for n in extra) and extra not in names:
                names.append(extra)
                found.append((int(p), tuple(extra)))
        if names:
            out[p] = names
        if a.qc and bl:
            qc_draw(im, boxes, bl, p)
        print('plate %2s: %d joined' % (p, len(names)), flush=True)

    groups = sorted({n for _p, n in found})
    print('\n%d of 62 plates carry a joined label, %d printed occurrences, '
          '%d distinct groups' % (len(out), len(found), len(groups)))
    for nm in groups:
        ps = sorted({p for p, n in found if n == nm})
        print('  %-24s plates %s' % ('/'.join(nm), ','.join(str(x) for x in ps)))
    if a.dry_run:
        return
    write_block(DB, out)


def qc_draw(im, boxes, bl, p):
    from PIL import ImageDraw
    c = im.convert('RGB')
    d = ImageDraw.Draw(c)
    for g in bl:
        d.rectangle((min(boxes[k][0] for k in g) - 5,
                     min(boxes[k][1] for k in g) - 5,
                     max(boxes[k][2] for k in g) + 5,
                     max(boxes[k][3] for k in g) + 5), outline=(0, 110, 255))
    c.save(os.path.join(A.QCDIR, 'chk_blocks_%02d.png' % int(p)))


NOTE = ("Abbreviations the atlas typesets into one printed label, per plate, and "
        "so names of one region between them rather than of one each: \"S1Tr/ "
        "LPtA\", \"Au1 (A1)\", \"Au1 (A1/AAF)\". Read off the printed page by "
        "tools/label_blocks.py, from the punctuation that joins them -- a slash "
        "between two names or ending the line above, or a bracket around the "
        "line below. Order is as printed, so the first is the name the label "
        "leads with. region_extents seeds a group as one, and the app answers "
        "for any name in a group with the group's one outline.")


def write_block(DB, out):
    """`label_blocks` into the database: the note, and one line per plate that
    carries a joined label (atlaslib.render_db lays the block out that way)."""
    DB['label_blocks'] = {'note': NOTE, 'data': {p: out[p] for p in sorted(out, key=int)}}
    A.save_db(DB)
    print('wrote %s' % A.JSON)


if __name__ == '__main__':
    main()
