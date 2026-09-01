#!/usr/bin/env python3
"""Read the atlas's two indexes against each other, and against the database.

The paper prints its structure list twice: an **Index of structures** ordered by
name (pp. S7-S14) and an **Index of abbreviations** ordered by abbreviation
(pp. S15-S22). `data/index_raw.txt` was taken from the second. `data/
index_structures_raw.txt` is the first, transcribed separately, so that the two
can disagree.

They are not independent about the *facts* -- both were almost certainly set
from one master table, so a mistake in that table appears in both -- but they
are independent about the *typesetting*, and that is what this catches.

Two things come out of the comparison:

  1. Every abbreviation, name and plate range agrees, which is the only evidence
     available that the 723 entries were transcribed correctly.

  2. The atlas writes a bare number for a structure on one plate and a range for
     a structure on several. Seven entries are written with a dash and no second
     plate to go with it -- four as `N-N`, three as `N-` with nothing after it.
     The Index of abbreviations renders those three as a plain `N`, so this is a
     fact only the Index of structures carries.

Of the four `N-N`, all four have the abbreviation printed on plate N+1 as well;
the database takes their range as N to N+1. Of the three `N-`, none does, and
the database leaves them at the single plate. See METHODS.

Usage:  python3 tools/check_indexes.py
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ABBR = os.path.join(ROOT, 'data', 'index_raw.txt')
STRUC = os.path.join(ROOT, 'data', 'index_structures_raw.txt')
JSON = os.path.join(ROOT, 'data', 'gerbil_atlas.json')

# The four the database extends by one plate, and the word read on that plate.
EXTENDED = {'AngT': 29, 'ZIC': 35, 'Su3C': 37, 'RLi': 36}

# The differences between the two indexes that are not disagreements about the
# atlas. Anything outside this list is a real one and fails the check.
EXPECTED_NAME = {
    'Bar': "an apostrophe: Barrington's, set as a right single quote",
    'VMHVL': 'the name drops out of the Index of structures text layer as '
             '"venalamic nucleus"; the Index of abbreviations sets it in full',
}
EXPECTED_RANGE = {
    'CAT': 'the Index of structures leaves the range open as "43-"',
    'IVF': 'the Index of structures leaves the range open as "25-"',
    'MnM': 'the Index of structures leaves the range open as "34-"',
}


def read(path, order):
    """`order` is the field order of the file: 'an' abbr-first, 'na' name-first."""
    out = {}
    for line in io.open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line:
            continue
        a, b, plates = line.split('|')
        ab, name = (a, b) if order == 'an' else (b, a)
        out[ab] = (name, plates)
    return out


def spread(plates):
    """The printed range as (first, last), or None where it has no second plate."""
    if '–' not in plates:
        return int(plates), int(plates)
    lo, hi = plates.split('–')
    if not hi or int(hi) <= int(lo):
        return None
    return int(lo), int(hi)


def main():
    A, S = read(ABBR, 'an'), read(STRUC, 'na')
    bad = 0

    only = (set(S) - set(A)) | (set(A) - set(S))
    if only:
        print('abbreviations in one index only: %s' % sorted(only))
        bad += 1
    else:
        print('both indexes list the same %d abbreviations' % len(A))

    for what, i, expect in (('name', 0, EXPECTED_NAME),
                            ('range', 1, EXPECTED_RANGE)):
        diff = sorted(ab for ab in A if ab in S and A[ab][i] != S[ab][i])
        print()
        print('%ss that differ between the indexes: %d' % (what, len(diff)))
        for ab in diff:
            print('  %-6s %s' % (ab, expect.get(ab, 'UNEXPECTED')))
            bad += ab not in expect

    print('\nranges the atlas writes with a dash and no second plate:')
    odd = {ab: p for ab, (_n, p) in S.items() if spread(p) is None}
    for ab in sorted(odd, key=lambda k: (k not in EXTENDED, k)):
        note = ('printed on plate %d too; database range extended'
                % EXTENDED[ab]) if ab in EXTENDED else \
               ('nothing printed past plate %s; database leaves it'
                % odd[ab].split('–')[0])
        print('  %-5s index %-7s %s' % (ab, odd[ab], note))

    DB = json.load(open(JSON))
    by = {r['abbr']: r for r in DB['structures']}
    print('\nagainst the database:')
    for ab, (_name, p) in sorted(S.items()):
        want = spread(p)
        if want is None:
            lo = int(p.split('–')[0])
            want = (lo, EXTENDED.get(ab, lo))
        got = (by[ab]['first_plate'], by[ab]['last_plate'])
        if got != want:
            print('  %-6s index %-8s database %s' % (ab, p, got))
            bad += 1
    print('  every range matches' if not bad else '  %d disagree' % bad)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
