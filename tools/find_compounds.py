#!/usr/bin/env python3
"""Find the labels that name two structures in one printed token, and split them.

The atlas sometimes says two names once. `9a,bCb` on plates 52-59 is 9aCb and
9bCb with the shared `9` said once and the shared `Cb` said once; `9/11N` on
plate 62 is 9N and 11N sharing their `N`; `dsc/oc` on plate 52 is the plain
join of two whole abbreviations. `label_blocks.py` already reads the joins the
atlas makes *between* two labels -- a slash ending a line, a bracket round the
one below -- but a mark *inside* one token joins two words neither of which is
printed whole, and it goes past that pass entirely: the reader sees one run of
ink, parses it against the 723 published abbreviations, and either takes the
longest one that fits (`9/11N` reads as `11N`, so 9N is never located) or fails
and leaves the whole token unread (`9a,bCb`, so neither lobule is).

So this pass asks the page a question the index can pose. For every plate, every
ordered pair of structures the index lists there with at least one not located,
sharing a prefix or a suffix, is elided the way the atlas would elide it, that
word is composed letter by letter from `find_unlettered`'s glyph library, and
slid over the page. The mark itself is left blank -- the face sets no comma
inside any of the 723 abbreviations, so there is no exemplar to compose one
from, and a 5-pixel hole costs less than a guess would.

The score only shortlists, as ever. Every candidate over KEEP was cut out of the
plate and read; READ holds the verdict on each and WAS says what the rejected
ones turned out to be.

What it writes, per confirmed compound: the whole token's box for each member
of it in `label_positions` that has no box on the token already -- the member the
reader did locate keeps the box it was read with, since one printed word is one
label -- and the members as a group in `label_blocks`.
Both follow the convention the atlas's own bracketed joins already use --
`Au1 (A1)` gives Au1 and A1 a box each and one `label_blocks` entry -- so
`build_region_extents.py` seeds them as one and files the region under the name
the token leads with, which is right: one printed label over one drawn area is
one region, whatever it is called.

Reads:  the source PDF (--pdf), data/gerbil_atlas.json
Writes: data/gerbil_atlas.json (label_positions and label_blocks)

Usage:  python3 tools/find_compounds.py --pdf path/to/GerbilAtlas.pdf
                                        [--plates PLATE,PLATE] [--dry-run]
                                        [--sheet PATH] [--dump PATH]
"""

import argparse
import json
import os
import sys
from collections import defaultdict

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                                          # noqa: E402
import find_unlettered as F                                   # noqa: E402
import label_blocks as LB                                     # noqa: E402

SEPW = 6        # the blank a comma or a slash is left as, in native px
MARK = 3        # ink pixels that have to stand in that blank for it to be a mark
KEEP = 0.55     # NCC a shortlisted match has to reach
WIN = 150       # native px searched either side of a located member's box
MOST = 2        # candidates offered per elision
TRIM = 2        # native px of white kept round the ink when the box is seated

# What was read on the plate, per (plate, token): one character per ranked
# candidate, `y` for the compound and `n` for something else, best first.
# Written by hand from the contact sheet `--sheet` prints. All 146 candidates
# over 116 tokens were cut from their own page and read; six tokens are real.
READ = {
    (9, 'M·ri'): 'n', (9, 'r·Mi'): 'n',
    (18, 'CPu·l'): 'n',
    (19, 'LV·AcbSh'): 'nn', (19, 'LV·SD'): 'nn', (19, 'Ld·AcbSh'): 'nn',
    (19, 'Ld·SD'): 'nn', (19, 'Ld·SI'): 'nn',
    (20, 'CPu·l'): 'n', (20, 'S1J·BF'): 'yy',
    (22, 'CB·l'): 'n', (22, 'CPu·l'): 'n', (22, 'Cg1·l'): 'n',
    (23, 'CPu·l'): 'n', (23, 'PS·e'): 'n',
    (25, 'CPu·l'): 'n', (25, 'S1Sh·Hi'): 'nn', (25, 'S2·Hi'): 'n',
    (25, 'SCh·Hi'): 'nn', (25, 'STMP·Hi'): 'n',
    (26, 'C·iml'): 'n',
    (28, 'Au1·13'): 'n', (28, 'AuD·13'): 'n', (28, 'LDDM·a'): 'n',
    (28, 'La·DDM'): 'nn', (28, 'La·DVL'): 'n', (28, 'PRh·aXi'): 'nn',
    (28, 'PaMM·Xi'): 'n', (28, 'RSG·cc'): 'nn', (28, 'chp·c'): 'n',
    (28, 'c·ec'): 'n', (28, 'i·cc'): 'n',
    (29, 'LHb·MDM'): 'n', (29, 'LHb·PMR'): 'nn', (29, 'LHb·VMHDM'): 'n',
    (29, 'La·Ent'): 'n', (29, 'La·Mol'): 'nn', (29, 'La·PLR'): 'nn',
    (29, 'La·PMR'): 'nn', (29, 'PRh·e'): 'n', (29, 'Pe·o'): 'n',
    (29, 'VM·MCLH'): 'n',
    (30, 'LHb·PMR'): 'n', (30, 'La·Mol'): 'n', (30, 'La·PLR'): 'nn',
    (30, 'La·PMR'): 'nn', (30, 'mf·Sub'): 'nn',
    (31, 'C·DM'): 'n', (31, 'D·CM'): 'n', (31, 'VG·MHSh'): 'n',
    (32, 'MoD·VG'): 'n', (32, 'V1·GMC'): 'nn', (32, 'V·A1'): 'n',
    (32, 'V·SubG'): 'n',
    (36, 'RSD·Gc'): 'nn', (36, 'RSGb·c'): 'yy', (36, 'RSGc·b'): 'nn',
    (39, 'IPC·I'): 'n', (39, 'IPI·C'): 'n', (39, 'IPI·L'): 'n',
    (39, 'IPL·C'): 'n', (39, 'IPL·I'): 'n', (39, 'IP·DRL'): 'n',
    (40, '4S·InWh'): 'nn',
    (41, 'InG·Wh'): 'y',
    (43, 'me·Su5'): 'n',
    (44, 'CGO·A'): 'n',
    (45, 'LSO·PBI'): 'n',
    (46, '6·5Cb'): 'n', (46, 'Gr·PnC'): 'n',
    (47, 'PF·ml'): 'n', (47, 'RIP·Pa'): 'n',
    (49, '3·4Cb'): 'y', (49, 'pl·simf'): 'n',
    (50, 's·5Sol'): 'nn',
    (52, '9a·bCb'): 'y', (52, '9b·aCb'): 'n', (52, 'Crus1·VL'): 'n',
    (52, 'Crus2·VL'): 'n',
    (53, '9a·bCb'): 'y', (53, '9b·aCb'): 'n', (53, 'IODM·Pr'): 'nn',
    (53, 'IOD·Pr'): 'n', (53, 'IOM·Pr'): 'nn',
    (54, '9a·bCb'): 'y', (54, '9b·aCb'): 'n', (54, 'Gi·r'): 'n',
    (54, 'IOD·PM'): 'n',
    (55, '9a·bCb'): 'y', (55, '9b·aCb'): 'n', (55, 'Crus2·C'): 'nn',
    (55, 'C·SolC'): 'n', (55, 'C·Sp5C'): 'n',
    (56, '9a·bCb'): 'y', (56, '9b·aCb'): 'n',
    (57, '9a·bCb'): 'y', (57, '9b·aCb'): 'n', (57, 'C·IOC'): 'nn',
    (57, 'LRtP·CC'): 'n', (57, 'Sol·CC'): 'n',
    (58, '9a·bCb'): 'y', (58, '9b·aCb'): 'n', (58, 'C·IOC'): 'n',
    (58, 'IOB·A'): 'n', (58, 'IOB·C'): 'n', (58, 'IOC·A'): 'n',
    (58, 'IOC·B'): 'n', (58, 'Sol·CC'): 'nn',
    (59, '9a·bCb'): 'y', (59, '9b·aCb'): 'n', (59, 'C·Sp5C'): 'n',
    (59, 'Sol·CC'): 'nn',
    (60, 'g·Gr'): 'n',
    (61, 'C·Sp5C'): 'n',
    (62, '9·11N'): 'y', (62, 'C·Sp5C'): 'n',
}

# What the rejected candidates turned out to be. Only the ones worth a reader's
# time: the same-order-reversed reading of a real compound, and the three that
# outscored one.
WAS = {
    (39, 'IPL·I', 0): 'the two separate labels IPL and IPC, printed side by side '
                      'with a leader each -- and the highest score in the whole '
                      'sweep at 0.88, which is why every candidate is read',
    (36, 'RSGc·b', 0): 'the real RSGb/c, read with its members the wrong way round',
    (36, 'RSGc·b', 1): 'the same, on the other hemisphere',
    (40, '4S·InWh', 0): 'the real InG/InWh, which label_blocks already has for '
                        'plate 40; the elided InG/Wh on 41 is the one this pass adds',
    (22, 'Cg1·l', 0): 'CG1 alone -- before the mark test this shape scored 0.83 on '
                      'eight plates and meant nothing',
}
for _p in range(52, 60):
    WAS[(_p, '9b·aCb', 0)] = 'the real 9a,bCb, read with its members reversed'


def affixes(a, b):
    """The prefix and suffix two abbreviations share."""
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    j = 0
    while j < min(len(a), len(b)) - i and a[len(a) - 1 - j] == b[len(b) - 1 - j]:
        j += 1
    return a[:i], (a[len(a) - j:] if j else '')


def elide(a, b):
    """`a` and `b` as one token, said the way the atlas says them.

    The shared prefix leads, the two middles are joined by the mark, the shared
    suffix ends it: 9aCb and 9bCb share `9` and `Cb`, so `9a,bCb`.
    """
    p, s = affixes(a, b)
    ma, mb = a[len(p):len(a) - len(s)], b[len(p):len(b) - len(s)]
    if not ma or not mb:
        return None                       # one word inside the other; not an elision
    return p + ma + '\x00' + mb + s       # \x00 is the mark, left blank


def compose(tok, lib, gaps):
    """The token as one bitmap, its letters on a common baseline, the mark blank.

    Returns the bitmap and the columns the mark would occupy, because leaving it
    blank is only half the job: a template that is one whole located word plus a
    blank plus one letter matches wherever that word is printed with anything at
    all beside it, which is how `Cg1,l` scores 0.83 on eight plates and means
    nothing. The blank has to be looked at afterwards -- see `marked`.
    """
    picks = []
    for ch in tok:
        if ch == '\x00':
            picks.append(None)
            continue
        g = lib.get(ch)
        if g is None:
            return None, None
        picks.append(g)
    real = [g for g in picks if g is not None]
    y0 = min(t for _b, t in real)
    H = max(t + b.shape[0] for b, t in real) - y0
    W = 0
    for i, g in enumerate(picks):
        W += SEPW if g is None else g[0].shape[1]
        if i < len(picks) - 1:
            W += 2 if g is None else gaps.get(tok[i], 3)
    out = np.zeros((H, W), np.uint8)
    x, span = 0, None
    for i, g in enumerate(picks):
        if g is None:
            span = (x, x + SEPW)
            x += SEPW + (2 if i < len(picks) - 1 else 0)
            continue
        b, t = g
        out[t - y0:t - y0 + b.shape[0], x:x + b.shape[1]] = b
        x += b.shape[1] + (gaps.get(tok[i], 3) if i < len(picks) - 1 else 0)
    return out, span


def drawn(plate, VECM, shape, cache={}):
    """Every line the atlas traced on this plate, from `svg/`, in the page frame."""
    return F._cached(cache, plate, lambda: LB.traced_mask(plate, VECM, shape), 4)


def blank_run(tpl, span):
    """The template's whole white gap around the mark, not just the mark's width.

    The mark is sampled over this rather than over `span`, because the letters
    either side of it carry their own sidebearing: the template is white from
    the end of one letter to the start of the next, and eight letters of
    accumulated spacing is enough to put a real comma a pixel or two outside the
    nominal blank -- which lost `9a,bCb` on plate 55 when this was a fixed
    window.
    """
    col = tpl.any(0)
    a, b = span
    while a > 0 and not col[a - 1]:
        a -= 1
    while b < tpl.shape[1] and not col[b]:
        b += 1
    return a, b


def marked(ink, x, y, shape, span, traced=None):
    """The ink standing where the mark would be, as pixels and as a shape.

    A comma is a few pixels low against the baseline; a slash leans across the
    whole band. Either way there is ink there, and in a plain gap between two
    separate words there is none -- which is the whole test, and it is a strong
    one: on plate 55 the printed `9a,bCb` puts four pixels in the gap and every
    wrong reading of the same neighborhood puts none.

    Ink lying on a path the atlas traced is not counted. A drawn boundary runs
    through the lettering at every angle and is as thin as a mark, so shape
    cannot tell them apart -- but the boundaries are already vectorized in
    `svg/`, so a stroke sitting on one is a boundary, said and not guessed. That
    is `label_blocks.py`'s reasoning, and its ONLINE threshold.
    """
    h, _w = shape
    x0, x1 = max(0, x + span[0]), x + span[1]
    y0, y1 = max(0, y), y + h
    sub = ink[y0:y1, x0:x1]
    if sub.size == 0:
        return 0, 0.0
    if traced is not None:
        sub = sub & ~traced[y0:y1, x0:x1]
    n = int(sub.sum())
    rows = np.where(sub.any(1))[0]
    tall = (rows[-1] - rows[0] + 1) / float(h) if len(rows) else 0.0
    return n, tall


def seat(ink, x, y, w, h):
    """The box actually on the ink, trimmed to it, from a template's placement."""
    sub = ink[max(0, y - TRIM):y + h + TRIM, max(0, x - TRIM):x + w + TRIM]
    if not sub.any():
        return x, y, x + w, y + h
    cols = np.where(sub.any(0))[0]
    rows = np.where(sub.any(1))[0]
    ox, oy = max(0, x - TRIM), max(0, y - TRIM)
    return (ox + int(cols[0]), oy + int(rows[0]),
            ox + int(cols[-1]) + 1, oy + int(rows[-1]) + 1)


def candidates(DB, plates):
    """Every elision the index could let the atlas set, on the plates asked for.

    Bounded three ways, because the combinatorics are otherwise hopeless: one of
    the two has to be *missing* on that plate (there is nothing to fix
    otherwise), they have to share an affix (an elision that shares nothing is a
    plain join, which `label_blocks` already reads), and where one of them *is*
    located the search runs in a window round its box rather than over the page.
    """
    LP = DB['label_positions']['data']
    on = defaultdict(list)
    for s in DB['structures']:
        for p in s['plates']:
            on[p].append(s['abbr'])
    out = []
    for p in plates:
        here = LP.get(str(p), {})
        miss = [a for a in on[p] if a not in here]
        for a in on[p]:
            for b in on[p]:
                if a == b or (a not in miss and b not in miss):
                    continue
                pre, suf = affixes(a, b)
                if not (pre or suf):
                    continue
                tok = elide(a, b)
                if tok is None:
                    continue
                anchor = a if a in here else (b if b in here else None)
                out.append((p, a, b, tok, anchor))
    return out


def windows(ink, boxes, shape):
    """Slices of a plate to score a template over, round a located member."""
    H, W = ink.shape
    th, tw = shape
    out = []
    for b in boxes:
        x0, y0, x1, y1 = F.box_native(b)
        out.append((max(0, x0 - WIN), max(0, y0 - 12),
                    min(W, x1 + WIN), min(H, y1 + 12)))
    return [(x0, y0, x1, y1) for x0, y0, x1, y1 in out
            if x1 - x0 > tw and y1 - y0 > th]


def overlap(a, b):
    """Intersection over union of two [cx, cy, w, h] boxes."""
    ox = max(0.0, min(a[0] + a[2] / 2, b[0] + b[2] / 2) - max(a[0] - a[2] / 2, b[0] - b[2] / 2))
    oy = max(0.0, min(a[1] + a[3] / 2, b[1] + b[3] / 2) - max(a[1] - a[3] / 2, b[1] - b[3] / 2))
    inter = ox * oy
    return inter / (a[2] * a[3] + b[2] * b[3] - inter) if inter else 0.0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--pdf', default=os.environ.get('GERBIL_ATLAS_PDF', ''),
                    help='the source PDF; or set GERBIL_ATLAS_PDF')
    ap.add_argument('--json', default=A.JSON, metavar='PATH')
    A.add_plates_arg(ap)
    ap.add_argument('--keep', type=float, default=KEEP, metavar='NCC')
    ap.add_argument('--mark', type=int, default=MARK, metavar='PX',
                    help='ink pixels the mark has to put in the gap (0 to see them all)')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--sheet', metavar='PATH',
                    help='write a contact sheet of every candidate, cut from its plate')
    ap.add_argument('--dump', metavar='PATH')
    args = ap.parse_args()
    if not args.pdf:
        ap.error('--pdf, or GERBIL_ATLAS_PDF, is needed: this pass reads the page')

    import pymupdf
    doc = pymupdf.open(args.pdf)
    VECM = A.vec_matrices()
    DB = A.load_db(args.json)
    LP = DB['label_positions']['data']
    plates = args.plates or list(range(1, A.N_PLATES + 1))

    cand = candidates(DB, plates)
    anch = [c for c in cand if c[4]]
    print('%d elisions the index could form on %d plates (%d anchored on a '
          'located member, %d not)' % (len(cand), len(plates), len(anch),
                                       len(cand) - len(anch)))

    # One glyph library per plate, not per candidate: the letters wanted on a
    # plate are wanted from the same neighborhood, and harvesting them once
    # turns a run that reads the same eight pages a thousand times into one that
    # reads them once.
    want = defaultdict(set)
    for p, _a, _b, tok, _an in cand:
        want[p] |= set(tok) - {'\x00'}
    libs = {}
    for p in sorted(want):
        order = sorted(range(1, A.N_PLATES + 1), key=lambda q: (abs(q - p), q))
        seen, gaps, used = F.harvest(doc, DB, want[p], order)
        libs[p] = ({ch: F.typical(ex) for ch, ex in seen.items()}, gaps)
        print('  plate %2d: %d letters from plates %d-%d'
              % (p, len(want[p]), min(used), max(used)))

    found, rows, unread = [], [], []
    for p, a, b, tok, anchor in cand:
        lib, gaps = libs[p]
        tpl, span = compose(tok, lib, gaps)
        if tpl is None:
            continue
        img = F.gray(doc, p)
        if anchor:
            hits = []
            for x0, y0, x1, y1 in windows(F.inkmap(doc, p), LP[str(p)][anchor],
                                          tpl.shape):
                sc = F.score(img[y0:y1, x0:x1], tpl)
                hits += [(v, x + x0, y + y0) for v, x, y in
                         F.peaks(sc, args.keep, MOST)]
            hits = sorted(hits, reverse=True)[:MOST]
        else:
            hits = F.peaks(F.score(img, tpl), args.keep, MOST)
        if not hits:
            continue
        # nothing standing where the mark should be means there is no mark, and
        # the two words are simply two words
        ink = F.inkmap(doc, p)
        gap = blank_run(tpl, span)
        kept = []
        for v, x, y in hits:
            n, tall = marked(ink, x, y, tpl.shape, gap, drawn(p, VECM, ink.shape))
            if n >= args.mark:
                kept.append((v, x, y, n, tall))
        if not kept:
            continue
        shown = tok.replace('\x00', '·')
        verdict = READ.get((p, shown), '')
        print('  plate %2d  %-14s = %-7s + %-7s  %s   %s'
              % (p, shown, a, b,
                 ' '.join('%.2f/%dpx' % (v, n) for v, _x, _y, n, _t in kept),
                 verdict[:len(kept)] or 'UNREAD'))
        if len(verdict) < len(kept):
            unread.append((p, shown))
        for i, (v, x, y, n, tall) in enumerate(kept):
            bx = seat(ink, x, y, tpl.shape[1], tpl.shape[0])
            box = F.box_fraction(*bx)
            rows.append({'plate': p, 'token': shown, 'members': [a, b], 'rank': i,
                         'ncc': round(v, 4), 'mark_px': n, 'mark_tall': round(tall, 2),
                         'box': box, 'read': verdict[i] if i < len(verdict) else '?',
                         'was': WAS.get((p, shown, i), '')})
            if i < len(verdict) and verdict[i] == 'y':
                found.append((p, [a, b], box))

    print('\n%d compounds read as the token, over %d plates'
          % (len(found), len({p for p, _m, _b in found})))
    if unread:
        print('%d tokens have candidates nobody has read: %s'
              % (len(unread), ' '.join('%s@%d' % (t, p) for p, t in unread)))
        print('  run with --sheet PATH, read it, and add the verdicts to READ')

    if args.dump:
        with open(args.dump, 'w', encoding='utf-8') as f:
            json.dump(rows, f, indent=1)
        print('candidates written to %s' % args.dump)
    if args.sheet:
        F.sheet(doc, [dict(r, abbr=r['token']) for r in rows], args.sheet)

    if A.refuse_partial_write(args, 'label_positions and label_blocks'):
        return 0
    if not found:
        print('nothing confirmed to write')
        return 0

    blocks = DB['label_blocks']['data']
    for p, members, box in found:
        d = LP.setdefault(str(p), {})
        for ab in members:
            # the anchored member was read from this same ink: a second box on it would
            # make one printed word two labels, and 11N on plate 62 was that for a while
            if any(overlap(b, box) > 0.3 for b in d.get(ab, [])):
                continue
            d.setdefault(ab, []).append(box)
        LP[str(p)] = {k: d[k] for k in sorted(d)}
        have = blocks.setdefault(str(p), [])
        if not any(set(g) == set(members) for g in have):
            have.append(list(members))
    DB['label_positions']['data'] = {k: LP[k] for k in sorted(LP, key=int)}
    DB['label_blocks']['data'] = {k: blocks[k] for k in sorted(blocks, key=int)}
    A.save_db(DB, args.json)
    print('\nwrote %s; rebuild the app with tools/build_app.py'
          % os.path.relpath(args.json, A.ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
