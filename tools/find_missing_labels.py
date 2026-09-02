#!/usr/bin/env python3
"""Find the printed labels the label pass missed, by matching the word itself.

The published **Index of structures** lists 3,506 structure-plate pairs. The
label pass located 3,270 of them. The rest divide into two kinds and only one is
a gap: a structure listed for a plate range is present at those levels but is not
necessarily *printed* on every plate of it, so some of the 236 were never on the
page -- and some were, and were missed. `MPtA` on plate 30 is the second kind. It
is printed, twice, in the same type as everywhere else, and the app could say
nothing about it: no box, so no seed, so no area, so nothing to point at.

Nothing here reads letters. The atlas sets every abbreviation in one typeface at
one size, so a word missed on one plate is a word already located on another, and
the question is only where that same picture appears again:

  1. Cut the word out of a plate where it *was* located -- the greyscale patch,
     trimmed to its own ink.
  2. Slide it over the plate where it was not, scoring normalised cross-
     correlation over the whole page by FFT. NCC and not a pixel overlap: the
     halftone ground and half a pixel of set-off put binary agreement for the
     same word on two plates at 0.6, which is where the wrong words are too.
  3. Keep the peaks above KEEP, and read every one of them against the printed
     plate. The score is a strong filter and not a decision: it cannot tell a
     word from the same word inside a longer one, which is what REJECT is for.

A found box is written in the convention `label_positions` already uses -- the
same offset from the matched patch that the source box had from its own -- so
what comes out is what the label pass would have written had it read the word.

Reads:  the source PDF (--pdf), data/gerbil_atlas.json
Writes: data/gerbil_atlas.json (extends label_positions); the app is rebuilt from
        it by tools/build_app.py. With --qc, qc/chk_found_NN.png for each plate
        that gained a label, every found box outlined on the plate.

Usage:  python3 tools/find_missing_labels.py --pdf path/to/GerbilAtlas.pdf
                                             [--dry-run] [--qc] [--dump found.json]
"""

import argparse
import json
import os
import sys

import numpy as np
from scipy.signal import fftconvolve

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                                          # noqa: E402
from atlaslib import to_native, from_native                   # noqa: E402
from label_blocks import native, denoise, INK                 # noqa: E402

PAD = 3         # native px of white kept around a cut word
KEEP = 0.80     # NCC a match has to reach; see the docstring for the spread
FLOOR = 36.0    # a window flatter than 6 grey levels of variance is blank paper
DEC = 4         # fraction decimals, as label_positions already uses

# The score says how like the word a patch is. It cannot say the patch is the
# whole word, and for a short abbreviation that is the whole difficulty: `sol`
# is printed inside `5Sol`, `Cu` inside `9a,bCb`, `I` inside `LaV`. Widening the
# template's white margin so a neighbouring letter falls inside it does not
# separate them either -- at every margin tried, a true `VTT` or `Rh` scores
# below a false `SHi` -- and neither does anything else that does not amount to
# reading the letters, which is the pass this one exists to patch rather than
# repeat.
#
# So the score proposes and the page disposes: all 47 candidates were put beside
# the printed plate and read. These are the ones that were not the word, with
# what they turned out to be. Listing them here rather than dropping them
# silently is what lets a re-run reproduce the committed block, and lets a
# reader check the judgement rather than take it.
REJECT = {
    (25, 'SHi'): 'the SHy printed in that face',
    (28, 'I'): 'the L of LaV',
    (29, 'I'): 'the L of LPtA',
    (29, 'LHb'): 'LHbL and LHbM, which are their own abbreviations',
    (39, 'IPL'): 'the IPl beside IPC -- l and I are one glyph in this face, so '
                 'which of the two it is cannot be settled by the picture',
    (47, 'ml'): 'the m of a longer abbreviation',
    (50, 'sol'): 'the Sol of 5Sol, and a capital where sol is lower case',
    (56, 'Cu'): 'the Cb of 9a,bCb',
}

# The mirror of REJECT: candidates that were read against the printed page and
# *were* the word, but score under KEEP. Four structures are set in the index as
# `N-N` where all 104 other one-plate structures are a bare number, and all four
# are printed on N+1 as well (METHODS, "Where the index gives itself away").
# Short words on a crowded plate score low -- `Su3C` on 37 peaks at 0.620 while
# a false `ZID` on 33 reaches 0.772 -- which is the same reason the page and not
# the score decides here. The floor is the score the confirmed candidate
# reached, so a re-run keeps those and admits nothing new beneath them.
CONFIRM = {
    (29, 'AngT'): 0.77,
    (35, 'ZIC'): 0.85,
    (37, 'Su3C'): 0.61,
    (36, 'RLi'): 0.64,
}


def ncc(I, T):
    """Normalised cross-correlation of T over I, by FFT, at every offset.

    Blank paper has no variance and would divide to noise, so it scores zero
    rather than something."""
    Tc = T - T.mean()
    tn = float(np.sqrt((Tc * Tc).sum()))
    if tn < 1e-3 or T.shape[0] >= I.shape[0] or T.shape[1] >= I.shape[1]:
        return None
    ones = np.ones_like(T)
    n = T.size
    s1 = fftconvolve(I, ones[::-1, ::-1], mode='valid')
    s2 = fftconvolve(I * I, ones[::-1, ::-1], mode='valid')
    num = fftconvolve(I, Tc[::-1, ::-1], mode='valid')
    var = s2 - s1 * s1 / n
    out = np.zeros_like(num)
    ok = var > n * FLOOR
    out[ok] = num[ok] / (np.sqrt(var[ok]) * tn)
    return out


def cut(grey, ink, box):
    """One word as a patch, trimmed to its ink, with the box's own offset kept."""
    x0, y0, x1, y1 = box
    r0, c0 = max(0, y0 - 8), max(0, x0 - 8)
    s = ink[r0:y1 + 8, c0:x1 + 8]
    if not s.any():
        return None
    r, c = np.where(s)
    a, b = max(0, r.min() - PAD), r.max() + 1 + PAD
    d, e = max(0, c.min() - PAD), c.max() + 1 + PAD
    return dict(t=grey[r0 + a:r0 + b, c0 + d:c0 + e],
                dx=x0 - (c0 + d), dy=y0 - (r0 + a),
                w=x1 - x0, h=y1 - y0)


def suppress(score, shape, thr, cap):
    """The strongest offsets, no two of them the same word twice."""
    out = []
    flat = np.argsort(score.ravel())[::-1]
    for f in flat[:200000]:
        r, c = divmod(int(f), score.shape[1])
        if score[r, c] < thr:
            break
        if any(abs(r - p[0]) < shape[0] * 0.7 and abs(c - p[1]) < shape[1] * 0.7
               for p in out):
            continue
        out.append((r, c, float(score[r, c])))
        if len(out) >= cap:
            break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf', default=os.environ.get('GERBIL_ATLAS_PDF', ''),
                    help='the source PDF; or set GERBIL_ATLAS_PDF')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--qc', action='store_true',
                    help='write qc/chk_found_NN.png: every word found, boxed on its plate')
    ap.add_argument('--dump', default='',
                    help='also write the finds, with their scores, as JSON')
    a = ap.parse_args()
    if not a.pdf:
        raise SystemExit('--pdf is required: this matches the printed word, and '
                         "the app's plate is too small to match one on.")
    import pymupdf
    doc = pymupdf.open(a.pdf)

    DB = A.load_db()
    NW = DB['plate_frame']['width_px']
    NH = DB['plate_frame']['height_px']
    LP = DB['label_positions']['data']

    # what the index lists and the label pass did not find
    want = {}
    for r in DB['structures']:
        for p in r['plates']:
            if r['abbr'] not in LP.get(str(p), {}):
                want.setdefault(p, []).append(r['abbr'])
    src = {}                                     # abbr -> plates that carry it
    for p, d in LP.items():
        for ab in d:
            src.setdefault(ab, []).append(int(p))

    # cut every template that will be needed, one decode per source plate
    need = sorted({q for ps in want.values() for ab in ps
                   for q in src.get(ab, [])})
    tpl = {}
    for q in need:
        g = np.asarray(native(doc, q), dtype=np.float32)
        k = denoise(np.asarray(native(doc, q)) < INK)
        for ab in LP[str(q)]:
            if not any(ab in ps for ps in want.values()):
                continue
            for cx, cy, bw, bh in LP[str(q)][ab]:
                x0, y0 = to_native((cx - bw / 2) * NW, (cy - bh / 2) * NH)
                x1, y1 = to_native((cx + bw / 2) * NW, (cy + bh / 2) * NH)
                t = cut(g, k, (int(round(x0)), int(round(y0)),
                               int(round(x1)), int(round(y1))))
                if t:
                    tpl.setdefault(ab, []).append(t)
        print('cut templates from plate %d' % q, flush=True)

    found, misses = {}, []
    for p in sorted(want):
        todo = [ab for ab in want[p] if tpl.get(ab)]
        if not todo:
            misses += [(p, ab) for ab in want[p]]
            continue
        I = np.asarray(native(doc, p), dtype=np.float32)
        taken = []
        for ab, bs in LP.get(str(p), {}).items():
            for cx, cy, bw, bh in bs:
                x0, y0 = to_native((cx - bw / 2) * NW, (cy - bh / 2) * NH)
                x1, y1 = to_native((cx + bw / 2) * NW, (cy + bh / 2) * NH)
                taken.append((x0, y0, x1, y1))
        for ab in todo:
            if (p, ab) in REJECT:
                misses.append((p, ab))
                print('  p%d %s: put aside -- %s' % (p, ab, REJECT[(p, ab)]),
                      flush=True)
                continue
            # every impression of the word, scored; the page keeps the best of
            # them at each offset, and the one that won says where its own box
            # sat, which is what turns an offset back into a label box
            scored = [(t, ncc(I, t['t'])) for t in tpl[ab]]
            scored = [(t, m) for t, m in scored if m is not None]
            if not scored:
                misses.append((p, ab))
                continue
            h = min(m.shape[0] for _t, m in scored)
            w = min(m.shape[1] for _t, m in scored)
            best = np.maximum.reduce([m[:h, :w] for _t, m in scored])
            pick = max(scored, key=lambda tm: tm[1][:h, :w].max())[0]
            cap = max(len(LP[str(q)][ab]) for q in src[ab])
            thr = CONFIRM.get((p, ab), KEEP)
            hits = suppress(best, pick['t'].shape, thr, cap)
            for r, c, s in hits:
                x0, y0 = c + pick['dx'], r + pick['dy']
                x1, y1 = x0 + pick['w'], y0 + pick['h']
                if any(min(x1, q[2]) > max(x0, q[0]) and
                       min(y1, q[3]) > max(y0, q[1]) for q in taken):
                    continue                     # a located label is already there
                taken.append((x0, y0, x1, y1))
                found.setdefault(p, {}).setdefault(ab, []).append(
                    (box_of(x0, y0, x1, y1, NW, NH), round(s, 3)))
            if not hits:
                misses.append((p, ab))
        print('plate %2d: %d of %d found' % (
            p, sum(len(v) for v in found.get(p, {}).values()), len(want[p])),
            flush=True)

    n = sum(len(v) for d in found.values() for v in d.values())
    pairs = sum(len(d) for d in found.values())
    print('\n%d printed labels found, over %d structure-plate pairs; '
          '%d pairs left unfound' % (n, pairs, len(misses)))
    for p in sorted(found):
        print('  plate %2d  %s' % (p, ', '.join(
            '%s x%d (%.2f)' % (ab, len(v), max(s for _b, s in v))
            for ab, v in sorted(found[p].items()))))
    if a.dump:
        with open(a.dump, 'w', encoding='utf8', newline='') as f:
            json.dump({str(k): d for k, d in found.items()}, f, indent=1)
        print('wrote %s' % a.dump)
    if a.qc:
        qc_draw(found, NW, NH)
    if a.dry_run:
        return
    write(DB, found)


def box_of(x0, y0, x1, y1, NW, NH):
    """A native page box back in the app's frame, as the [cx, cy, w, h] fractions
    label_positions stores."""
    ax0, ay0 = from_native(x0, y0)
    ax1, ay1 = from_native(x1, y1)
    return [round((ax0 + ax1) / 2 / NW, DEC), round((ay0 + ay1) / 2 / NH, DEC),
            round((ax1 - ax0) / NW, DEC), round((ay1 - ay0) / NH, DEC)]


def write(DB, found):
    """Extend `label_positions` with what was found and write the database.

    Each plate's abbreviations are kept sorted, as the block is, and the app's
    __BOX__ is rebuilt from the database by tools/build_app.py."""
    LP = DB['label_positions']['data']
    for p, d in found.items():
        for ab, v in d.items():
            LP.setdefault(str(p), {})[ab] = [b for b, _s in v]
        LP[str(p)] = {k: LP[str(p)][k] for k in sorted(LP[str(p)])}
    DB['label_positions']['data'] = {k: LP[k] for k in sorted(LP, key=int)}
    A.save_db(DB)
    print('wrote %s' % A.JSON)


def qc_draw(found, NW, NH):
    """Every found box outlined on the plate it was found on, one PNG per plate
    that gained a label, with the abbreviation and its score beside it."""
    from PIL import ImageDraw
    os.makedirs(A.QCDIR, exist_ok=True)
    for p in sorted(found):
        im = A.plate_image('drawing', p).convert('RGB')
        d = ImageDraw.Draw(im)
        for ab, v in sorted(found[p].items()):
            for (cx, cy, w, h), s in v:
                x0, y0 = (cx - w / 2) * NW, (cy - h / 2) * NH
                x1, y1 = (cx + w / 2) * NW, (cy + h / 2) * NH
                d.rectangle((x0 - 1, y0 - 1, x1 + 1, y1 + 1), outline=(0, 110, 255))
                d.text((x0, y1 + 2), '%s %.2f' % (ab, s), fill=(0, 110, 255))
        path = os.path.join(A.QCDIR, 'chk_found_%02d.png' % p)
        im.save(path)
        print('  wrote %s' % os.path.relpath(path, A.ROOT))


if __name__ == '__main__':
    main()
