#!/usr/bin/env python3
"""Every leader line the atlas draws, and the labels it belongs to.

Where a region is too small or too crowded to hold the word that names it, the atlas
sets the abbreviation outside and draws a thin line to the place it means.
`tools/label_leaders.py` read those lines off the printed page and wrote their far ends
into `label_leaders`; this reads the block back out. One row per leader, with the label
it was drawn from, what the line costs in millimeters of brain, and which region each of
its two ends falls in -- the question `label_leaders` answers per plate as a triplet, put
the way a reader asks it.

A leader is one drawn line, and the block records its end against every name in the label
it was drawn from: `E/OV` on plate 3 is one line and two entries, because the atlas
typeset the two names as one label and drew the line from the whole of it (see
`label_blocks`). So the rows here are labels -- 240 of them -- and `line` is what says
which of them are one line: 219 lines, 21 of which two names share.

Two lengths, because they answer different questions. `length` is the line as printed,
from the edge of the word to the tip. `moves` is from the center of the box to the tip:
how far the label's recorded position travels once the line is followed, which is what
the seed `build_region_extents.py` drops, the stereotaxic center the app quotes and the
point a planner aims at all shift by. Both are recomputed from the committed block in the
plate frame's own millimeters, and both are the label's own -- where two names share a
line, each is measured from its own word. `label_leaders.summary` measured the same lines
on the 300 dpi page and gave both names of a joined label the one figure it read there,
so its longest line, 1.231 mm, is the longest here among the lines no label shares -- the
`aci` on plate 1 -- and the 1.395 mm at the top of `--sort length` is the second word of
the `E/OV` on plate 4, which the summary never measured on its own.

Which region an end falls in is answered exactly as the app answers a click: the extents
of that plate, even-odd, at the point itself. The region the label names is the expected
answer, and 178 of the 240 give it. No region at all -- 54 of them -- means an unassigned
face, or a structure so thin that its simplified outline does not quite hold the point
that seeded it; it is not a fault by itself, and neither is a face under the 600 px the
extraction publishes, which is what leaves `I` on plate 23, `LVPO` on 44 and `RPa` on 58
with a tip in the middle of a face they solely own and no area to show for it.

A tip in a *neighbor's* ground is the one that reads as a question, and there are eight.
Five are names that name no region at all: a fissure is the line between two regions, so
a line drawn to one lands in whichever of them holds the point (see `features`). The other
three are marks the pass misread and read here as what they are -- `4Sh` and `4N` on plate
39, `Sp5O` on 51, each printed inside the region it names and so drawn no line by the
atlas. Those three are superseded by `seed_overrides`, which is why the extents no longer
follow them and why the tip is now plainly sitting in the neighbor it used to take ground
from; `superseded_by` is the column that says so. `--odd` is that question as a filter.

Reads:  data/gerbil_atlas.json, and nothing else. Stdlib only, and no PDF: the lines were
        read off the printed page once, by tools/label_leaders.py, and committed.
Writes: nothing, unless --csv or --json names a file.

Usage:  python3 tools/leaders.py                     # every leader, in plate order
        python3 tools/leaders.py --plates 30         # one plate, or 28-33, or 5,30,45
        python3 tools/leaders.py --abbr VMHSh        # one name, wherever it is led
        python3 tools/leaders.py --abbr "auditory cortex"   # or any alias the atlas keeps
        python3 tools/leaders.py --shared            # the lines a joined label shares
        python3 tools/leaders.py --odd               # tips outside the region they name
        python3 tools/leaders.py --sort length --limit 20
        python3 tools/leaders.py --csv out.csv       # or - for stdout; --json likewise
"""
import argparse
import json
import math
import os
import signal
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                            # noqa: E402
from export_tables import csv_text, fmt         # noqa: E402

NONE = '--'                 # inside the section and in no region's extent
UNASS = 'unassigned'        # ...in a face the extraction could give to no name
OFF = 'off-section'         # ...and outside the drawn section altogether, as a word
                            # printed in the margin is


# ------------------------------------------------------------------- the block

def name_map(db, plate):
    """Every name of a joined label, pointing at the name its region is filed under."""
    out = {}
    for g in db.get('label_blocks', {}).get('data', {}).get(str(plate), []):
        for n in g[1:]:
            out[n] = g[0]
    return out


def holder(regs, unass, outline, x, y):
    """Which region's extent holds a plate-frame point: the app's own hit test.

    The abbreviation, `unassigned` for a face the extraction could give to no name,
    `off-section` for a point outside the drawn section -- which is where a good many
    printed words are, and is the reason their labels were given a line at all -- and
    `--` for a point on the section that no extent holds. Regions tile, so two hits
    would be a fault in the extents rather than a fact about the point; both are named
    if it ever happens.
    """
    hits = [ab for ab, v in regs.items()
            if sum(A.pip(g, x, y) for g in v['g']) % 2]
    if hits:
        return '/'.join(sorted(hits))
    if sum(A.pip(g, x, y) for g in unass) % 2:
        return UNASS
    return NONE if sum(A.pip(g, x, y) for g in outline) % 2 else OFF


def leaders(db, plates=None):
    """One row per recorded leader end, in plate then label order.

    Each row carries the label it belongs to, the line's two ends in fractions and in
    millimeters, its two lengths, what holds each end, and the id of the line itself --
    which several rows share where several names share one printed label.
    """
    pf = db['plate_frame']
    fr = A.Frame(pf)
    mm_x = lambda dx: dx * pf['width_px'] / pf['ml_px_per_mm']
    mm_y = lambda dy: dy * pf['height_px'] / pf['dv_px_per_mm']
    breg = A.bregma_of(db)
    names = {s['abbr']: s['name'] for s in db['structures']}
    LL = db['label_leaders']['data']
    LP = db['label_positions']['data']
    RE = db['region_extents']['data']
    UN = db['region_extents']['unassigned']
    SO = db.get('seed_overrides', {}).get('data', {})
    BO = db['brain_outline']['data']

    out = []
    for p in (plates or range(1, A.N_PLATES + 1)):
        tips = LL.get(str(p))
        if not tips:
            continue
        nm, regs = name_map(db, p), RE.get(str(p), {})
        unass, outline = UN.get(str(p), []), BO.get(str(p), [])
        # a line is one point, however many names were given it; number them across the
        # plate so that rows sharing a line show it, and the id is stable between runs
        line_id = {t: 'p%d.%d' % (p, i + 1) for i, t in
                   enumerate(sorted({(x, y) for v in tips.values() for _i, x, y in v}))}
        rows = []
        for ab in sorted(tips):
            for i, tx, ty in sorted(tips[ab]):
                cx, cy, w, h = LP[str(p)][ab][i]
                # the printed line runs from the edge of the word; the position moves
                # from its center. Zero inside the box, as label_leaders measured it.
                edge = math.hypot(mm_x(max(cx - w / 2 - tx, 0, tx - (cx + w / 2))),
                                  mm_y(max(cy - h / 2 - ty, 0, ty - (cy + h / 2))))
                own = nm.get(ab, ab)
                sup = [r for r in SO.get(str(p), {}).get(ab, []) if r[0] == i]
                rows.append({
                    'plate': p, 'bregma': breg[p], 'abbr': ab, 'name': names.get(ab, ''),
                    'index': i, 'line': line_id[(tx, ty)],
                    'box': [cx, cy, w, h], 'tip': [tx, ty],
                    'box_ml': fr.ml_f(cx), 'box_dv': fr.dv_f(cy),
                    'tip_ml': fr.ml_f(tx), 'tip_dv': fr.dv_f(ty),
                    'length_mm': edge,
                    'moves_mm': math.hypot(mm_x(tx - cx), mm_y(ty - cy)),
                    'word_in': holder(regs, unass, outline, cx, cy),
                    'tip_in': holder(regs, unass, outline, tx, ty),
                    'region': own,          # the name its region is filed under
                    'feature': ab in A.FEATURES,
                    'superseded_by': sup[0][3] if sup else '',
                    'with': [],
                })
        for r in rows:                      # the other names on the same drawn line
            r['with'] = [q['abbr'] for q in rows if q['line'] == r['line'] and q is not r]
        out += rows
    return out


def lands(r):
    """Where the tip landed, as one word: `own`, `other`, or `none`."""
    if r['tip_in'] in (NONE, UNASS, OFF):
        return 'none'
    return 'own' if r['region'] in r['tip_in'].split('/') else 'other'


# ----------------------------------------------------------------- the filters

def expand(db, spec):
    """A --abbr argument -> the abbreviations it names.

    An abbreviation is itself; anything else is looked for in `aliases`, which is where
    the atlas's own collective names live -- `auditory cortex` is five abbreviations.
    """
    known = {s['abbr'] for s in db['structures']}
    al = {k.lower(): v for k, v in db['aliases'].items()}
    want, bad = set(), []
    for tok in (t.strip() for t in spec.split(',') if t.strip()):
        if tok in known:
            want.add(tok)
        elif tok.lower() in al:
            want.update(al[tok.lower()])
        else:
            bad.append(tok)
    if bad:
        raise SystemExit('no such abbreviation or alias: %s' % ', '.join(bad))
    return want


def select(rows, a, db):
    if a.abbr:
        want = expand(db, a.abbr)
        rows = [r for r in rows if r['abbr'] in want]
    if a.shared:
        rows = [r for r in rows if r['with']]
    if a.odd:
        rows = [r for r in rows if lands(r) != 'own']
    if a.min_mm:
        rows = [r for r in rows if r['length_mm'] >= a.min_mm]
    if a.sort == 'length':
        rows = sorted(rows, key=lambda r: -r['length_mm'])
    if a.limit:
        rows = rows[:a.limit]
    return rows


# ------------------------------------------------------------------ the output

HEAD = ('plate  abbr       i  length   moves  the word in   the tip in        ML       DV  '
        'structure')


def report(rows, db, all_rows, plates):
    if rows:
        print(HEAD)
    for r in rows:
        note = '  [with %s]' % ', '.join(r['with']) if r['with'] else ''
        if r['superseded_by']:
            note += '  [superseded by %s]' % r['superseded_by']
        print('%5d  %-8s %2d  %6.2f  %6.2f  %-12s  %-12s  %+7.2f  %+7.2f  %s%s'
              % (r['plate'], r['abbr'], r['index'], r['length_mm'], r['moves_mm'],
                 r['word_in'], r['tip_in'], r['tip_ml'], r['tip_dv'], r['name'], note))
    summary(rows, db, all_rows, plates)


def summary(rows, db, all_rows, plates):
    if not rows:
        print('\nno leaders match')
        return
    lines = {r['line'] for r in rows}
    shared = {r['line'] for r in rows if r['with']}
    on = {r['plate'] for r in rows}
    ln = sorted(r['length_mm'] for r in rows)
    mv = sorted(r['moves_mm'] for r in rows)
    where = {k: [r for r in rows if lands(r) == k] for k in ('own', 'other', 'none')}
    read = set(plates or range(1, A.N_PLATES + 1))
    n_lab = sum(len(v) for q, d in db['label_positions']['data'].items()
                if int(q) in read for v in d.values())
    print('\n%d label%s on %d drawn line%s over %d plate%s%s'
          % (len(rows), '' if len(rows) == 1 else 's', len(lines),
             '' if len(lines) == 1 else 's', len(on), '' if len(on) == 1 else 's',
             '; %d of the lines a joined label shares' % len(shared) if shared else ''))
    print('the printed line: median %.2f mm, longest %.2f mm; the position moves a median '
          '%.2f mm, at most %.2f mm' % (statistics.median(ln), ln[-1],
                                        statistics.median(mv), mv[-1]))
    print('where the tips land: %d in the region their label names, %d in a neighbor%s, '
          '%d in no region -- an unassigned face, or an outline too thin to hold its own '
          'seed' % (len(where['own']), len(where['other']),
                    ' (all of them names that name no region: see features)'
                    if where['other'] and all(r['feature'] for r in where['other']) else '',
                    len(where['none'])))
    if len(rows) == len(all_rows):
        scope = ('in the atlas' if not plates else
                 'on that plate' if len(read) == 1 else 'on those %d plates' % len(read))
        print('%d of the %d printed labels %s carry a leader; the rest are printed on the '
              'region they name' % (len(rows), n_lab, scope))
    top = {}
    for r in rows:
        top[r['abbr']] = top.get(r['abbr'], 0) + 1
    best = [(k, v) for k, v in sorted(top.items(), key=lambda kv: (-kv[1], kv[0])) if v > 1]
    if best:
        print('most often led: ' + ', '.join('%s %d' % kv for kv in best[:8]))


COLS = ['plate', 'bregma_ap_mm', 'abbr', 'name', 'label_index', 'line', 'shares_with',
        'leader_length_mm', 'position_moves_mm', 'box_cx_frac', 'box_cy_frac',
        'box_ml_mm', 'box_dv_mm', 'tip_x_frac', 'tip_y_frac', 'tip_ml_mm', 'tip_dv_mm',
        'word_in', 'tip_in', 'tip_lands', 'names_no_region', 'superseded_by']


def table(rows):
    out = []
    for r in rows:
        out.append([r['plate'], fmt(r['bregma']), r['abbr'], r['name'], r['index'],
                    r['line'], ' '.join(r['with']), fmt(r['length_mm'], 3),
                    fmt(r['moves_mm'], 3), fmt(r['box'][0], 4), fmt(r['box'][1], 4),
                    fmt(r['box_ml']), fmt(r['box_dv']), fmt(r['tip'][0], 4),
                    fmt(r['tip'][1], 4), fmt(r['tip_ml']), fmt(r['tip_dv']),
                    r['word_in'], r['tip_in'], lands(r),
                    'yes' if r['feature'] else '', r['superseded_by']])
    return csv_text(out, COLS)


def as_json(rows):
    """The same rows, grouped by the line they were drawn from."""
    out = {}
    for r in rows:
        g = out.setdefault(r['line'], {
            'line': r['line'], 'plate': r['plate'], 'bregma_ap_mm': r['bregma'],
            'tip': {'x_frac': r['tip'][0], 'y_frac': r['tip'][1],
                    'ml_mm': round(r['tip_ml'], 3), 'dv_mm': round(r['tip_dv'], 3)},
            'tip_in': r['tip_in'], 'tip_lands': lands(r), 'labels': []})
        g['labels'].append({
            'abbr': r['abbr'], 'name': r['name'], 'index': r['index'],
            'box': r['box'], 'box_ml_mm': round(r['box_ml'], 3),
            'box_dv_mm': round(r['box_dv'], 3), 'word_in': r['word_in'],
            'leader_length_mm': round(r['length_mm'], 3),
            'position_moves_mm': round(r['moves_mm'], 3),
            'names_no_region': r['feature'], 'superseded_by': r['superseded_by']})
    return json.dumps(list(out.values()), indent=1, ensure_ascii=False) + '\n'


def write(text, path, what):
    if path == '-':
        sys.stdout.write(text)
        return
    with open(path, 'w', encoding='utf8', newline='') as f:
        f.write(text)
    full = os.path.abspath(path)
    try:                                        # a path off the repository keeps its own
        full = os.path.relpath(full, A.ROOT) if os.path.commonpath(
            [full, A.ROOT]) == A.ROOT else full
    except ValueError:                          # another drive, on Windows
        pass
    print('wrote %s (%s)' % (full, what))


# ----------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    A.add_plates_arg(ap)
    ap.add_argument('--abbr', help='only these names: an abbreviation, an alias such as '
                                   '"auditory cortex", or a comma-separated list of either')
    ap.add_argument('--shared', action='store_true',
                    help='only the lines the atlas drew from a label of several names')
    ap.add_argument('--odd', action='store_true',
                    help='only the leaders whose tip does not land in the region its '
                         'label names')
    ap.add_argument('--min-mm', type=float, default=0.0,
                    help='only lines at least this long, in millimeters')
    ap.add_argument('--sort', choices=('plate', 'length'), default='plate',
                    help='plate order (default) or longest line first')
    ap.add_argument('--limit', type=int, default=0, help='stop after this many rows')
    ap.add_argument('--csv', metavar='PATH', help='write the rows as CSV; - for stdout')
    ap.add_argument('--json', metavar='PATH', dest='json_path',
                    help='write them grouped by drawn line, as JSON; - for stdout')
    a = ap.parse_args()
    if hasattr(signal, 'SIGPIPE'):              # 240 rows: `| head` is the normal thing
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)

    db = A.load_db()
    all_rows = leaders(db, a.plates)
    rows = select(all_rows, a, db)
    if a.csv:
        write(table(rows), a.csv, '%d rows' % len(rows))
    if a.json_path:
        write(as_json(rows), a.json_path, '%d lines' % len({r['line'] for r in rows}))
    if not (a.csv or a.json_path):
        report(rows, db, all_rows, a.plates)
    elif '-' not in (a.csv, a.json_path):       # stdout is the table; keep it clean
        summary(rows, db, all_rows, a.plates)
    return 0


if __name__ == '__main__':
    sys.exit(main())
