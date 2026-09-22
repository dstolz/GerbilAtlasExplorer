#!/usr/bin/env python3
"""Wholes and their parts: where the atlas draws a structure under its parts' names.

The published index lists the claustrum, `Cl`, on plates 12-27. The plates print `Cl` on
12-15 and 27, and on 16-26 they print `DCl` and `VCl` -- the dorsal and ventral parts --
and never `Cl`. So the whole has no label, no extent and no voxel on eleven of the
sixteen plates the index puts it on, and the app tells a reader on plate 20 that the
label of `Cl` was not located, when the atlas printed its parts instead.

This builds the table that says so: for each such whole, which structures are its parts,
on which plates the parts stand in for it, on which the whole is drawn itself, and on
which both are drawn. It adds no geometry and changes nothing published. A part stays a
structure with its own row, label, outline, mesh and colour; `structures[].plates` stays
the index's. The app reads the table to say two true sentences (the card names the parts,
the plate says the atlas drew `Cl` as `DCl` and `VCl` here) and, at the reader's option,
to fold the parts' outlines, labels, meshes and volume into the whole's -- derived from
the parts' own, the way a gross division's are derived from its members'.

Like the divisions, this is a convenience layer added here and NOT part of the published
atlas. Unlike them it is not a judgement about anatomy: every row is admitted by a rule
over what the plates print, and refused where the rule does not hold.

A part is a structure whose name reads "<x> part of <whole>" or "<whole>, <x> part";
its whole is the longest comma-prefix of that name that is itself a structure. A whole
is then one of three kinds:

    admitted   on at least one plate the index lists for the whole, the whole has no
               located label and no extent, and a part has an extent: the parts stand in
    outside    a part is printed on a plate the index does not give the whole -- folding
               would extend the structure past its published range, so the row is
               refused whole, not clipped
    moot       the parts are only ever printed beside the whole, so nothing stands in

Only admitted wholes get a row, and every admitted whole must have one: `--check` fails
if a re-cut of the extents turns a moot pair into an admitted one, the way a change to
`FREE` fails build_groups.py. The 23 outside and the 7 moot are written into the block
too, so the exclusions are on record rather than omissions.

The rows are declarative so they can be read and argued with:

    whole    the abbreviation of the whole
    parts    its parts, every one the name pattern finds, in the order to show them
    note     what the plates print, and any judgement the row rests on

Usage:

    python3 tools/build_parts.py            write the `parts` block into the database
    python3 tools/build_parts.py --report   print every candidate and its kind, write nothing
    python3 tools/build_parts.py --check    exit 1 if the committed block is stale

Stdlib only.
"""
import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A  # noqa: E402

PARTS = [
    dict(whole='Cl', parts=('DCl', 'VCl'),
         note='Plates 16-26 print the dorsal and ventral parts and no Cl; the index lists '
              'Cl on 12-27, and the plates print Cl itself on 12-15 and 27. Read on the '
              'plates: the two parts together are the claustrum at those levels.'),
    dict(whole='Cu', parts=('CuR',),
         note='Plate 56 prints the rotundus part and no Cu; the index lists Cu on 52-62, '
              'and the plates print Cu itself on 52-55 and 57-62. On 55 both are drawn, '
              'and the fold unions them. Whether the rest of the cuneate nucleus is drawn '
              'on 56 unlabelled, or CuR is what the atlas means by the whole at that level, '
              'is a judgement the plate has to settle; the rule admits the row.'),
    dict(whole='DM', parts=('DMC', 'DMD', 'DMV'),
         note='Plate 31 prints the compact, dorsal and ventral parts and no DM; the index '
              'lists DM on 29-32, and the plates print DM itself on 29, 30 and 32.'),
    dict(whole='LDTg', parts=('LDTgV',),
         note='Plate 43 prints the ventral part and no LDTg; the index lists LDTg on 42-44, '
              'and the plates print LDTg itself on 42 and 44.'),
    dict(whole='LHb', parts=('LHbL', 'LHbM'),
         note='Plates 29-30 print the lateral and medial parts and no LHb; the index lists '
              'LHb on 28-31, and the plates print LHb itself on 28 and 31.'),
    dict(whole='La', parts=('LaD', 'LaV'),
         note='Plates 28-30 print the dorsal and ventral parts and no La; the index lists '
              'La on 26-31, and the plates print La itself on 26, 27 and 31. On 27 the '
              'whole and both parts are drawn, and the fold unions them.'),
    dict(whole='MPB', parts=('MPBE',),
         note='Plate 44 prints the external part and no MPB; the index lists MPB on 43-45, '
              'and the plates print MPB itself on 43 and 45. Only the external part stands '
              'in: whether the rest of the medial parabrachial nucleus is drawn on 44 '
              'unlabelled, or MPBE is what the atlas means by the whole at that level, is a '
              'judgement the plate has to settle; the rule admits the row.'),
    dict(whole='VG', parts=('VGMC', 'VGPC'),
         note='Plates 31-32 print the magnocellular and parvicellular parts and no VG; the '
              'index lists VG on 29-34, and the plates print VG itself on 29, 30, 33 and 34.'),
    dict(whole='VMH', parts=('VMHC', 'VMHDM', 'VMHVL'),
         note='Plates 29-30 print the central, dorsomedial and ventrolateral parts and no '
              'VMH; the index lists VMH on 28-31, and the plates print VMH itself on 28 '
              'and 31.'),
]

# the two forms a part's name takes; the whole it names is resolved by whole_of()
PART_OF = re.compile(r'^(?P<qual>.+?) part of (?P<whole>.+)$', re.I)
COMMA_PART = re.compile(r'^(?P<whole>.+), (?P<qual>[^,]+?) part$', re.I)

RULE = ('a part is a structure whose name reads "<x> part of <whole>" or "<whole>, <x> '
        'part"; its whole is the longest comma-prefix of that name that is a structure. A '
        'whole is admitted where, on a plate the index lists for it, it has no located label '
        'and no extent and a part has an extent; refused whole where a part is printed on a '
        'plate the index does not give the whole; moot where nothing stands in.')


def whole_of(name, byname):
    """The whole a part's name names, or None; and the text the name gave for it."""
    m = PART_OF.match(name) or COMMA_PART.match(name)
    if not m:
        return None, None
    text = m.group('whole')
    pieces = [p.strip() for p in text.split(',')]
    for k in range(len(pieces), 0, -1):
        w = byname.get(', '.join(pieces[:k]).lower())
        if w:
            return w, text
    return None, text


def candidates(db):
    """Every whole the name pattern finds, with its parts and its kind.

    Returns {whole: dict(parts, kind, outside, own, stand_in, shared)} where kind is
    'admitted', 'outside' or 'moot', and `outside` maps a part to the plates it is printed
    on past the whole's index range. Also returns the parts whose name says they are a
    part of something the atlas does not name, which are not candidates for anything."""
    S = {s['abbr']: s for s in db['structures']}
    byname = {s['name'].lower(): s['abbr'] for s in db['structures']}
    LP, RE = db['label_positions']['data'], db['region_extents']['data']
    named, unnamed = {}, []
    for s in db['structures']:
        w, text = whole_of(s['name'], byname)
        if text is None:
            continue
        if w:
            named.setdefault(w, []).append(s['abbr'])
        else:
            unnamed.append(s['abbr'])
    out = {}
    for w, ps in named.items():
        R = set(S[w]['plates'])
        outside = {p: sorted(set(S[p]['plates']) - R) for p in ps if set(S[p]['plates']) - R}
        own = sorted(p for p in R if w in RE.get(str(p), {}))
        stand = sorted(p for p in R if w not in LP.get(str(p), {}) and w not in RE.get(str(p), {})
                       and any(q in RE.get(str(p), {}) for q in ps))
        shared = sorted(p for p in own if any(q in RE.get(str(p), {}) for q in ps))
        kind = 'outside' if outside else ('admitted' if stand else 'moot')
        out[w] = dict(parts=sorted(ps, key=lambda x: (x.lower(), x)), kind=kind,
                      outside=outside, own=own, stand_in=stand, shared=shared)
    return out, sorted(unnamed, key=lambda x: (x.lower(), x))


def block(db):
    """The `parts` block, exactly as it goes into the database; exits on a row that does
    not hold, or an admitted whole with no row."""
    S = {s['abbr']: s for s in db['structures']}
    cand, _unnamed = candidates(db)
    rows, seen = [], set()
    for r in PARTS:
        w = r['whole']
        if w in seen:
            sys.exit('build_parts: %s has two rows' % w)
        seen.add(w)
        unknown = [a for a in (w,) + tuple(r['parts']) if a not in S]
        if unknown:
            sys.exit('build_parts: %s names structures the atlas has not: %s'
                     % (w, ', '.join(unknown)))
        c = cand.get(w)
        if c is None:
            sys.exit('build_parts: no structure is named as a part of %s (%s)' % (w, S[w]['name']))
        listed, found = set(r['parts']), set(c['parts'])
        if listed != found:
            sys.exit('build_parts: the parts of %s are %s by the name rule; the row lists %s'
                     % (w, ' '.join(c['parts']), ' '.join(r['parts'])))
        if c['kind'] == 'outside':
            sys.exit('build_parts: %s is refused -- a part is printed past the index range %d-%d: %s'
                     % (w, S[w]['first_plate'], S[w]['last_plate'],
                        '; '.join('%s on %s' % (p, ' '.join(map(str, pl))) for p, pl in c['outside'].items())))
        if c['kind'] == 'moot':
            sys.exit('build_parts: %s is moot -- no plate prints only its parts' % w)
        if not r.get('note'):
            sys.exit('build_parts: %s has no note' % w)
        rows.append({
            'whole': w,
            'name': S[w]['name'],
            'parts': list(r['parts']),
            'part_names': [S[p]['name'] for p in r['parts']],
            'first_plate': S[w]['first_plate'],
            'last_plate': S[w]['last_plate'],
            'stand_in_plates': c['stand_in'],
            'own_plates': c['own'],
            'shared_plates': c['shared'],
            'note': r['note'],
        })
    admitted = sorted(w for w, c in cand.items() if c['kind'] == 'admitted')
    missing = [w for w in admitted if w not in seen]
    if missing:
        sys.exit('build_parts: admitted by the rule and given no row: %s\nAdd a row to PARTS, '
                 'with a note saying what the plates print.' % ', '.join(missing))
    return {
        'note': 'Wholes the atlas draws under their parts\' names, added here and not part of '
                'the published atlas. A row names a structure the index lists on plates where '
                'the plates print only its parts, and says which plates those are; nothing '
                'about the whole or the parts is changed by it. The app reads it to say so on '
                'the card and the plate, and to fold the parts into the whole when a reader '
                'asks. Built by tools/build_parts.py.',
        'rule': RULE,
        'report': {
            'admitted': admitted,
            'outside_index': sorted(w for w, c in cand.items() if c['kind'] == 'outside'),
            'moot': sorted(w for w, c in cand.items() if c['kind'] == 'moot'),
        },
        'data': rows,
    }


def _range(plates):
    if not plates:
        return '-'
    out, a, b = [], plates[0], plates[0]
    for p in plates[1:]:
        if p == b + 1:
            b = p
        else:
            out.append('%d-%d' % (a, b) if a != b else str(a))
            a = b = p
    out.append('%d-%d' % (a, b) if a != b else str(a))
    return ', '.join(out)


def report(db):
    S = {s['abbr']: s for s in db['structures']}
    cand, unnamed = candidates(db)
    n_parts = sum(len(c['parts']) for c in cand.values())
    print('%d structures are named as a part of something; %d of a whole the atlas names '
          '(%d wholes), %d of one it does not\n'
          % (n_parts + len(unnamed), n_parts, len(cand), len(unnamed)))
    for kind, title in (('admitted', 'admitted -- the parts stand in for the whole'),
                        ('outside', 'refused -- a part is printed past the index range'),
                        ('moot', 'moot -- the parts are only printed beside the whole')):
        ws = sorted(w for w, c in cand.items() if c['kind'] == kind)
        print('%s (%d)' % (title, len(ws)))
        for w in ws:
            c = cand[w]
            line = '  %-6s %-22s index %-6s' % (w, ' '.join(c['parts']),
                                                  '%d-%d' % (S[w]['first_plate'], S[w]['last_plate']))
            if kind == 'admitted':
                line += '  whole on %-14s stand in %-8s shared %s' % (
                    _range(c['own']), _range(c['stand_in']), _range(c['shared']))
            elif kind == 'outside':
                line += '  past it: ' + '; '.join('%s on %s' % (p, _range(pl)) for p, pl in c['outside'].items())
            print(line)
        print()
    pairs = sum(len(c['stand_in']) for c in cand.values() if c['kind'] == 'admitted')
    print('stand-in structure-plate pairs: %d' % pairs)
    print('parts of a whole the atlas does not name (%d): %s' % (len(unnamed), ' '.join(unnamed)))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--report', action='store_true', help='print every candidate, write nothing')
    ap.add_argument('--check', action='store_true', help='exit 1 if the committed block is stale')
    a = ap.parse_args()
    db = A.load_db()
    if a.report:
        return report(db)
    fresh = block(db)
    if a.check:
        if db.get('parts') == fresh:
            print('parts: current')
            return 0
        print('parts: STALE -- run tools/build_parts.py')
        return 1
    if db.get('parts') == fresh:
        print('parts: unchanged (%d wholes)' % len(fresh['data']))
        return 0
    # beside the divisions, which are the other block that is a layer over the structures
    items = [kv for kv in db.items() if kv[0] != 'parts']
    db.clear()
    for k, v in items:
        db[k] = v
        if k == 'groups':
            db['parts'] = fresh
    if 'parts' not in db:
        db['parts'] = fresh
    A.save_db(db)
    print('parts: wrote %d wholes, %d stand-in plates between them'
          % (len(fresh['data']), sum(len(r['stand_in_plates']) for r in fresh['data'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
