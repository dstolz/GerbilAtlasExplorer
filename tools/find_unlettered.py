#!/usr/bin/env python3
"""Find the printed labels no plate carries a located copy of, by building the word.

`find_missing_labels.py` cuts a word out of a plate that carries it and matches it
back on one that does not. That is the right tool for a structure the label pass
found somewhere and missed somewhere else -- and it is structurally unable to help
a structure it found *nowhere*, because there is no copy to cut. Twenty structures
are in that position: the published index lists them, they are printed on the page,
and the app can say nothing about them on any plate. This is the pass for those.

Nothing here reads letters either. The atlas sets every abbreviation in one face at
one size, so a word never located is still a word whose *letters* have been located
several thousand times over in other words, and the question is only what that
arrangement of them looks like:

  1. Cut the located labels into glyphs -- the face sets them with clear white
     between, so a column with no ink is a letter boundary -- and keep each letter
     with its offset from the word's baseline. A word whose glyph count does not
     match its character count is dropped rather than guessed at.
  2. For each letter, keep the exemplar most like its fellows, so a stray box or a
     letter clipped by a boundary line cannot become the template for a whole run.
  3. Compose the missing word from those letters on a common baseline, and slide it
     over the plate by normalized cross-correlation, exactly as the other pass does.
  4. Read every peak above KEEP against the printed plate before keeping it.

Step 4 is not a formality. A composed template is a weaker claim than a cut one --
the spacing is the median of the face and not this word's -- so the scores run lower
and the wrong words run closer. REJECT below is what was read and thrown out.

Reads:  the source PDF (--pdf), data/gerbil_atlas.json
Writes: data/gerbil_atlas.json (extends label_positions); the app is rebuilt from it
        by tools/build_app.py. With --qc, qc/chk_built_NN.png per plate that gained
        a label, every box outlined on the plate.

Usage:  python3 tools/find_unlettered.py --pdf path/to/GerbilAtlas.pdf
                                         [--only ABBR,ABBR] [--dry-run] [--qc]
                                         [--dump found.json]
"""

import argparse
import io
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy.signal import fftconvolve

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                                          # noqa: E402
from atlaslib import to_native, from_native                   # noqa: E402
from label_blocks import native, denoise, INK                 # noqa: E402

PAD = 3         # native px of white looked at around a word's box
RUN = 2         # columns of white that separate one glyph from the next
MINEX = 12      # exemplars a letter needs before its template is trusted
NEAR = 8        # plates read for a word's letters, once every letter has enough
CAP = 20        # ...and at most this many, for a letter that is nowhere to be had
SEP = 22        # native px between two peaks for them to be two labels
MOST = 3        # candidates offered per structure-plate pair
DEC = 4         # fraction decimals, as label_positions already uses

# A composed word is a weaker claim than a cut one: its spacing is the median of
# the face rather than this word's, and the atlas draws its region boundaries
# straight through the lettering, so the same word scores 0.86 where it stands
# clear and 0.57 where a boundary crosses it. A threshold that keeps the second
# also keeps the wrong words. So the threshold is only a shortlist -- the score
# proposes, and READ below is the page disposing.
KEEP = 0.45

# What was read on the plate, per structure-plate pair: one character per ranked
# candidate, `y` for the word and `n` for something else, best-scoring first.
# Written by hand from the contact sheet `--sheet` prints, which is the whole
# point of this table: every box the pass writes was looked at on the printed
# page first, and a pair with no entry here is reported and not written.
READ = {
    # SHy is the one entry here the published index does not list at all -- the atlas
    # prints it on plates 22 to 25 and neither index carries a septohypothalamic row,
    # so it reached this pass with no located copy for the same reason as the rest and
    # for a different cause. See verification.known_source_discrepancies.
    (22, 'SHy'): 'yny',
    (23, 'SHy'): 'yyn',
    (24, 'SHy'): 'yyy',
    (25, 'SHy'): 'yyn',
    (23, 'AVPe'): 'ynn',
    (26, 'SChVM'): 'y',
    (39, 'tfp'): 'ynn',
    (43, 'DTgP'): 'nyy',
    (44, 'RPO'): 'yyn',
    (52, 'Bo'): 'yny',
    (54, 'PSol'): 'nyn',
    (55, 'PSol'): 'yyn',
    (55, 'SolC'): 'nyn',
    (56, 'SolC'): 'nnn',
    (57, 'SolC'): 'nnn',
    (58, 'SolC'): 'nnn',
    (59, 'SolC'): 'nnn',
    (59, 'MnA'): 'ynn',
    (60, 'SolC'): 'ynn',
    (60, 'MnA'): 'ynn',
    (60, 'dcs'): 'yyn',
    (61, 'SolC'): 'ynn',
    (61, 'MnA'): 'ynn',
    (61, 'dcs'): 'yyn',
    (62, 'SolC'): 'ynn',
    (62, 'MnA'): 'ynn',
    (62, 'dcs'): 'yyn',
}

# What the rejected candidates turned out to be. Not needed to run; kept so a
# reader can check the judgement rather than take it, and so that the two words
# this method keeps offering are on the record as the ones to expect.
WAS = {
    (22, 'SHy', 1): 'SHi, which the composed word matches on every plate that prints it',
    (23, 'SHy', 2): 'SHi', (25, 'SHy', 2): 'the SFi printed under LSD',
    (23, 'AVPe', 1): 'VP', (23, 'AVPe', 2): 'VP, the other hemisphere',
    (39, 'tfp', 1): 'fmj', (39, 'tfp', 2): 'PMnR',
    (43, 'DTgP', 0): 'LDTg, which holds DTg whole and outscores the word itself',
    (44, 'RPO', 2): 'LPBC',
    (52, 'Bo', 1): 'the Ro printed under 12N',
    (54, 'PSol', 0): '5Sol', (54, 'PSol', 2): '5Sol, the other hemisphere',
    (55, 'PSol', 2): '5Sol',
    (55, 'SolC', 0): '5Sol', (55, 'SolC', 2): '5Sol, the other hemisphere',
    (56, 'SolC', 0): 'Sp5I', (56, 'SolC', 2): 'Sp5I, the other hemisphere',
    (56, 'SolC', 1): 'the Sol of M Sol M set over a C of its own -- see SHORTHAND',
    (57, 'SolC', 0): 'the same Sol over C',
    (57, 'SolC', 1): 'Sp5C', (57, 'SolC', 2): 'Sp5C, the other hemisphere',
    (58, 'SolC', 1): 'the same Sol over C',
    (58, 'SolC', 0): 'Sp5C', (58, 'SolC', 2): 'Sp5C, the other hemisphere',
    (59, 'SolC', 0): 'the same Sol over C',
    (59, 'SolC', 1): 'Sp5C', (59, 'SolC', 2): 'Sp5C, the other hemisphere',
    (59, 'MnA', 1): 'MdD', (59, 'MnA', 2): 'MdV',
    (60, 'MnA', 1): 'MdD', (60, 'MnA', 2): 'MdD, the other hemisphere',
    (61, 'MnA', 1): 'MdD', (61, 'MnA', 2): 'MdD, the other hemisphere',
    (62, 'MnA', 1): 'MdD', (62, 'MnA', 2): 'MdD, the other hemisphere',
    (60, 'SolC', 1): 'Sp5C', (60, 'SolC', 2): 'Sp5C, the other hemisphere',
    (61, 'SolC', 1): 'Sp5C', (61, 'SolC', 2): 'Sp5C, the other hemisphere',
    (62, 'SolC', 1): 'Sp5C', (62, 'SolC', 2): 'Sp5C, the other hemisphere',
    (60, 'dcs', 2): 'dsc', (61, 'dcs', 2): 'dsc', (62, 'dcs', 2): 'dsc',
}

# Read off the plates while checking the above, and the reason four of SolC's
# eight plates stay empty: from 56 to 59 the atlas letters the solitary complex
# by bare suffix -- `M Sol M` on one line with a `C` under it, and `DL`, `VL`,
# `V` around them -- so the words SolC, SolM, SolDL, SolVL and SolV are not on
# those pages at all, and there is nothing for this pass to match. On 55 and
# 60-62 SolC is set in full and is found. Fixing the suffix labels means giving
# the reader the convention, not a better template.
SHORTHAND = {'SolC': [56, 57, 58, 59], 'SolM': [55, 56, 57, 58, 59],
             'SolDL': [55, 56, 57], 'SolV': [55, 56, 57], 'SolVL': [55, 56, 57]}

# The three kinds this pass cannot reach, and why. Kept here rather than in a
# commit message because a later run will find them missing and ask the question
# again. See METHODS.
UNREACHABLE = {
    '9aCb': 'set as one label, 9a,bCb, with 9bCb -- needs a comma this face never '
            'sets in an abbreviation, so there is no exemplar to compose with',
    '9bCb': 'the same 9a,bCb',
    '9N': 'set as 9/11N; the located 11N is that label, so 9N needs the block read '
          'rather than the word found',
    'SolDL': 'lettered DL, a bare suffix beside sol -- the word SolDL is not on the page',
    'SolM': 'lettered M',
    'SolV': 'lettered V',
    'SolVL': 'lettered VL',
    'p1PAG': 'set in italic, the only italics on any plate; no italic exemplar exists '
             'anywhere in the located labels to compose from',
    'p1Rt': 'set in italic',
}


# ---------------------------------------------------------------- the page

def _cached(cache, key, make, most=16):
    if key not in cache:
        if len(cache) >= most:              # these are 5-20 MB each
            cache.pop(next(iter(cache)))
        cache[key] = make()
    return cache[key]


def inkmap(doc, plate, cache={}):
    """One plate as a binary ink mask, denoised of the halftone ground."""
    return _cached(cache, plate, lambda: denoise(
        (np.asarray(native(doc, plate), np.uint8) < INK).astype(np.uint8)))


def gray(doc, plate, cache={}):
    """The same plate as floats with ink high, which is what NCC scores over."""
    return _cached(cache, plate, lambda:
                   1.0 - np.asarray(native(doc, plate), np.float32) / 255.0, 4)


def box_native(box):
    """A label_positions box (cx, cy, w, h fractions) as native pixels."""
    cx, cy, w, h = box
    x0, y0 = to_native((cx - w / 2) * A.NW, (cy - h / 2) * A.NH)
    x1, y1 = to_native((cx + w / 2) * A.NW, (cy + h / 2) * A.NH)
    return int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))


def box_fraction(x0, y0, x1, y1):
    """The inverse, in the convention label_positions stores."""
    ax0, ay0 = from_native(x0, y0)
    ax1, ay1 = from_native(x1, y1)
    return [round(v, DEC) for v in
            ((ax0 + ax1) / 2 / A.NW, (ay0 + ay1) / 2 / A.NH,
             (ax1 - ax0) / A.NW, (ay1 - ay0) / A.NH)]


# ---------------------------------------------------------------- the letters

def columns(sub):
    """The runs of inked columns in a word, split on RUN columns of white."""
    col = sub.any(0)
    runs, start, gap = [], None, 0
    for i, c in enumerate(col):
        if c:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= RUN:
                runs.append((start, i - gap + 1))
                start = None
    if start is not None:
        runs.append((start, len(col)))
    return runs


def cut_glyphs(ink, box, word, gaps=None):
    """One located label as (letter, bitmap, top relative to the word's baseline).

    The baseline is the modal bottom row of the word's glyphs: a face sets most
    letters on it and hangs the few descenders below, so the mode is the line and
    not an average pulled down by the `p` in `PnO`. A word whose glyph count does
    not match its letter count is dropped -- two letters run together, or a
    boundary line crossing the word, and either way which run is which letter is a
    guess this pass has no need to make.
    """
    x0, y0, x1, y1 = box
    sub = ink[max(0, y0 - PAD):y1 + PAD, max(0, x0 - PAD):x1 + PAD]
    if sub.size == 0 or not sub.any():
        return []
    runs = columns(sub)
    if len(runs) != len(word):
        return []
    out, bottoms = [], []
    for a, b in runs:
        g = sub[:, a:b]
        rows = np.where(g.any(1))[0]
        out.append((g[rows[0]:rows[-1] + 1], int(rows[0]), int(rows[-1])))
        bottoms.append(int(rows[-1]))
    base = max(set(bottoms), key=bottoms.count)
    if gaps is not None:
        for i in range(len(runs) - 1):
            gaps.setdefault(word[i], []).append(runs[i + 1][0] - runs[i][1])
    return [(ch, g, top - base) for ch, (g, top, _bot) in zip(word, out)]


def harvest(doc, DB, need, plates):
    """A template per letter, and the space the face sets after it, from the
    located labels, over as few plates as will do.

    Plates are read until every letter wanted has MINEX exemplars, so a run that
    needs six letters does not decode all 62 pages to get them. The spacing is
    measured here rather than assumed because it is not one number: this face
    sets two columns after a `t` and seven after a `1`, and a word composed on
    one average drifts far enough by its fourth letter to score as a near miss.
    """
    LP = DB['label_positions']['data']
    seen = {ch: [] for ch in need}
    gaps = {}
    used = []
    for p in plates:
        enough = all(len(seen[ch]) >= MINEX for ch in need)
        if (enough and len(used) >= NEAR) or len(used) >= CAP:
            break
        here = LP.get(str(p))
        if not here:
            continue
        ink = inkmap(doc, p)
        used.append(p)
        for word, boxes in here.items():
            for b in boxes:
                cut = cut_glyphs(ink, box_native(b), word, gaps)
                if not (set(word) & set(need)):
                    continue
                for ch, g, top in cut:
                    if ch in seen:
                        seen[ch].append((g, top))
    return seen, {ch: sorted(v)[len(v) // 2] for ch, v in gaps.items()}, used


def typical(exemplars):
    """The exemplar most like its fellows, among those of the commonest size.

    A letter clipped by a region boundary, or one whose box caught a neighbor's
    stroke, is the wrong size or the wrong shape; taking the modal size first and
    then the member nearest that group's mean drops both without a threshold.
    """
    if not exemplars:
        return None
    sizes = [g.shape for g, _t in exemplars]
    size = max(set(sizes), key=sizes.count)
    group = [(g, t) for (g, t) in exemplars if g.shape == size]
    if len(group) < 2:
        return group[0]
    stack = np.stack([g.astype(np.float32) for g, _t in group])
    mean = stack.mean(0)
    score = ((stack - mean) ** 2).sum((1, 2))
    i = int(np.argmin(score))
    tops = [t for _g, t in group]
    return group[i][0], max(set(tops), key=tops.count)


def compose(word, lib, gaps):
    """The word as one bitmap, its letters set on a common baseline and spaced as
    the face spaces them after each letter."""
    picks = [lib.get(ch) for ch in word]
    if any(p is None for p in picks):
        return None
    adv = [gaps.get(ch, 3) for ch in word[:-1]]
    tops = [t for _g, t in picks]
    hs = [g.shape[0] for g, _t in picks]
    y0 = min(tops)
    H = max(t + h for t, h in zip(tops, hs)) - y0
    W = sum(g.shape[1] for g, _t in picks) + sum(adv)
    out = np.zeros((H, W), np.uint8)
    x = 0
    for i, (g, t) in enumerate(picks):
        out[t - y0:t - y0 + g.shape[0], x:x + g.shape[1]] = g
        x += g.shape[1] + (adv[i] if i < len(adv) else 0)
    return out


# ---------------------------------------------------------------- the search

def score(img, tpl):
    """Normalized cross-correlation of a binary template over a whole plate.

    NCC and not a pixel overlap, for the reason the other pass gives: the halftone
    ground and half a pixel of set-off put binary agreement for the same word on
    two plates where the wrong words are.
    """
    t = tpl.astype(np.float32)
    t = t - t.mean()
    th, tw = t.shape
    ones = np.ones((th, tw), np.float32)
    num = fftconvolve(img, t[::-1, ::-1], mode='valid')
    s1 = fftconvolve(img, ones, mode='valid')
    s2 = fftconvolve(img * img, ones, mode='valid')
    n = float(th * tw)
    var = np.maximum(s2 - s1 * s1 / n, 1e-6)
    return num / np.sqrt(var * float((t * t).sum()))


def peaks(sc, keep, most=8):
    """The best non-overlapping positions over `keep`, best first."""
    s = sc.copy()
    out = []
    for _ in range(most):
        i = int(np.argmax(s))
        y, x = divmod(i, s.shape[1])
        v = float(s[y, x])
        if v < keep:
            break
        out.append((v, x, y))
        s[max(0, y - SEP):y + SEP, max(0, x - SEP):x + SEP] = -9.0
    return out


def sheet(doc, cand, path, pad=26, zoom=4):
    """Every candidate cut from its own plate, captioned, one row per pair.

    This is what READ is written from. A candidate is shown with enough of the
    page around it to read the word *and* what it sits next to, because half of
    what a wrong match turns out to be is a word that is only wrong in company --
    the `Sol` of `5Sol`, the `Ro` of `Rob`.
    """
    from PIL import ImageDraw
    rows = {}
    for c in cand:
        rows.setdefault((c['plate'], c['abbr']), []).append(c)
    tiles = []
    for (p, a), cs in sorted(rows.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        im = native(doc, p)
        for c in cs:
            x0, y0, x1, y1 = box_native(c['box'])
            crop = im.crop((max(0, x0 - pad), max(0, y0 - pad), x1 + pad, y1 + pad))
            crop = crop.resize((crop.width * zoom, crop.height * zoom), Image.LANCZOS)
            tiles.append(('%s p%d #%d %.2f' % (a, p, c['rank'], c['ncc']), crop))
    if not tiles:
        return
    cols = 4
    cw = max(t.width for _c, t in tiles) + 12
    ch = max(t.height for _c, t in tiles) + 26
    rowsn = (len(tiles) + cols - 1) // cols
    out = Image.new('RGB', (cols * cw, rowsn * ch), (255, 255, 255))
    d = ImageDraw.Draw(out)
    for i, (cap, t) in enumerate(tiles):
        x, y = (i % cols) * cw, (i // cols) * ch
        out.paste(t, (x + 6, y + 20))
        d.text((x + 6, y + 5), cap, fill=(180, 20, 20))
        d.rectangle([x + 5, y + 19, x + 6 + t.width, y + 20 + t.height],
                    outline=(210, 210, 210))
    out.save(path)
    print('contact sheet: %d candidates -> %s' % (len(tiles), path))


def targets(DB, only):
    """Structures the index lists that have no located label on any of their plates."""
    LP = DB['label_positions']['data']
    out = []
    for s in DB['structures']:
        a = s['abbr']
        if only and a not in only:
            continue
        if any(a in LP.get(str(p), {}) for p in s['plates']):
            continue
        out.append((a, s['name'], s['plates']))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--pdf', default=os.environ.get('GERBIL_ATLAS_PDF', ''), metavar='PATH',
                    help='the source atlas PDF (or set $GERBIL_ATLAS_PDF)')
    ap.add_argument('--json', default=A.JSON, metavar='PATH')
    ap.add_argument('--only', default='', metavar='ABBR,ABBR',
                    help='restrict to these abbreviations')
    ap.add_argument('--keep', type=float, default=KEEP, metavar='NCC')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--qc', action='store_true')
    ap.add_argument('--dump', metavar='PATH', help='write the candidates as JSON')
    ap.add_argument('--sheet', metavar='PATH',
                    help='write a contact sheet of every candidate, cut from its '
                         'plate and captioned, to be read against READ')
    args = ap.parse_args()

    import pymupdf
    doc = pymupdf.open(args.pdf)
    DB = A.load_db(args.json)
    only = {a for a in args.only.split(',') if a}

    want = targets(DB, only)
    reach = [(a, n, p) for a, n, p in want if a not in UNREACHABLE]
    skip = [(a, n, p) for a, n, p in want if a in UNREACHABLE]
    print('%d structures have no located label on any plate the index gives them'
          % len(want))
    for a, _n, _p in skip:
        print('  %-7s not reachable here: %s' % (a, UNREACHABLE[a]))
    print('  %d to look for: %s' % (len(reach), ' '.join(a for a, _n, _p in reach)))
    if not reach:
        return 0

    found, cand, unread = {}, [], []
    for a, name, plates in reach:
        # This word's letters, cut from the pages nearest the ones it is wanted on.
        # Not one library for the run: the same letter is a slightly different
        # picture sixty plates away -- a different exposure of the same plate, a
        # hair more ink -- and composing DTgP from the far end of the atlas puts it
        # below LDTg on its own page, where composing it from its neighbors puts
        # both of its printed copies above.
        order = sorted(range(1, A.N_PLATES + 1),
                       key=lambda p: (min(abs(p - q) for q in plates), p))
        seen, gaps, used = harvest(doc, DB, set(a), order)
        lib = {ch: typical(ex) for ch, ex in seen.items()}
        missing = sorted(ch for ch in set(a) if lib.get(ch) is None)
        tpl = None if missing else compose(a, lib, gaps)
        if tpl is None:
            print('\n%-7s cannot be composed: no exemplar of %s in the atlas'
                  % (a, ' '.join(missing)))
            continue
        thin = sorted(ch for ch in set(a) if len(seen[ch]) < MINEX)
        print('\n%-7s %-46s template %dx%d' % (a, name, tpl.shape[1], tpl.shape[0]))
        print('        letters from plates %d-%d: %s%s'
              % (min(used), max(used),
                 ' '.join('%s%d' % (ch, len(seen[ch])) for ch in sorted(set(a))),
                 '   thin: ' + ' '.join(thin) if thin else ''))
        for p in plates:
            hits = peaks(score(gray(doc, p), tpl), args.keep, MOST)
            verdict = READ.get((p, a), '')
            line = ' '.join('%.2f' % v for v, _x, _y in hits) or '-'
            if hits and len(verdict) < len(hits):
                unread.append((p, a, len(hits)))
                mark = '  UNREAD'
            else:
                mark = '  ' + (verdict[:len(hits)] or '-')
            print('        plate %2d  %-20s%s' % (p, line, mark))
            for i, (v, x, y) in enumerate(hits):
                b = box_fraction(x, y, x + tpl.shape[1], y + tpl.shape[0])
                yes = i < len(verdict) and verdict[i] == 'y'
                cand.append({'plate': p, 'abbr': a, 'rank': i, 'ncc': round(v, 4),
                             'box': b, 'read': verdict[i] if i < len(verdict) else '?',
                             'was': WAS.get((p, a, i), '')})
                if yes:
                    found.setdefault(str(p), {}).setdefault(a, []).append(b)

    n = sum(len(v) for pl in found.values() for v in pl.values())
    print('\n%d labels read as the word, over %d structure-plate pairs'
          % (n, sum(len(pl) for pl in found.values())))
    if unread:
        print('%d pairs have candidates nobody has read: %s'
              % (len(unread), ' '.join('%s@%d' % (a, p) for p, a, _k in unread)))
        print('  run with --sheet PATH, read it, and add the verdicts to READ')

    if args.dump:
        with open(args.dump, 'w', encoding='utf-8') as f:
            json.dump(cand, f, indent=1)
        print('candidates written to %s' % args.dump)

    if args.sheet:
        sheet(doc, cand, args.sheet)

    if args.qc:
        from PIL import ImageDraw
        os.makedirs(A.QCDIR, exist_ok=True)
        for p, pl in sorted(found.items(), key=lambda kv: int(kv[0])):
            im = A.plate_image('drawing', int(p)).convert('RGB')
            d = ImageDraw.Draw(im)
            for a, boxes in sorted(pl.items()):
                for cx, cy, w, h in boxes:
                    x0, y0 = (cx - w / 2) * A.NW, (cy - h / 2) * A.NH
                    x1, y1 = (cx + w / 2) * A.NW, (cy + h / 2) * A.NH
                    # blue, because the drawing plates are printed in red-brown
                    d.rectangle((x0 - 1, y0 - 1, x1 + 1, y1 + 1), outline=(0, 110, 255))
                    d.text((x0, y1 + 2), a, fill=(0, 110, 255))
            out = os.path.join(A.QCDIR, 'chk_built_%02d.png' % int(p))
            im.save(out)
            print('  wrote %s' % os.path.relpath(out, A.ROOT))

    if args.dry_run:
        print('\ndry run: %s not written' % os.path.relpath(args.json, A.ROOT))
        return 0

    # each plate's abbreviations sorted, as the block is, and the plates in order
    LP = DB['label_positions']['data']
    for p, pl in found.items():
        LP.setdefault(p, {}).update(pl)
        LP[p] = {k: LP[p][k] for k in sorted(LP[p])}
    DB['label_positions']['data'] = {k: LP[k] for k in sorted(LP, key=int)}
    A.save_db(DB, args.json)
    print('\nwrote %s; rebuild the app with tools/build_app.py'
          % os.path.relpath(args.json, A.ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
