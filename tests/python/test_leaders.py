"""tools/leaders.py: the leader block read back out, against the block it came from.

The tool derives nothing the pipeline does not already carry -- it puts `label_leaders`
the way a reader asks for it -- so what these check is that nothing is lost or invented
on the way out, and that the arithmetic is the arithmetic label_leaders.py did.
"""
import math

import pytest

import atlaslib as A
import leaders as L


@pytest.fixture(scope='module')
def db():
    return A.load_db()


@pytest.fixture(scope='module')
def rows(db):
    return L.leaders(db)


def test_every_recorded_end_is_a_row(db, rows):
    """One row per triplet in the block, and the same triplet."""
    block = [(int(p), ab, i, x, y)
             for p, d in db['label_leaders']['data'].items()
             for ab, tips in d.items() for i, x, y in tips]
    assert len(rows) == len(block) == db['label_leaders']['summary']['leaders_found'] == 240
    assert sorted((r['plate'], r['abbr'], r['index'], r['tip'][0], r['tip'][1])
                  for r in rows) == sorted(block)


def test_a_row_carries_its_printed_box(db, rows):
    for r in rows:
        assert r['box'] == db['label_positions']['data'][str(r['plate'])][r['abbr']][r['index']]


def test_a_line_is_one_point_however_many_names_share_it(rows):
    """219 drawn lines under 240 labels: 21 of them a joined label shares.

    The block records one line against every name in the label it was drawn from, so
    the rows are labels; `line` is what says which of them are the same line, and every
    row on one line has to name the same point on the same plate.
    """
    by = {}
    for r in rows:
        by.setdefault(r['line'], []).append(r)
    assert len(by) == 219
    assert sum(1 for v in by.values() if len(v) > 1) == 21
    for line, v in by.items():
        assert len({(q['plate'], tuple(q['tip'])) for q in v}) == 1, line
        for q in v:
            assert sorted(q['with']) == sorted(x['abbr'] for x in v if x is not q)


def test_the_longest_line_is_the_one_the_summary_measured(db, rows):
    """The tool's millimeters are label_leaders.py's, read the same way.

    `label_leaders.summary` measured from the edge of the box the line was drawn from,
    and gave both names of a joined label that one figure. So among the lines no label
    shares -- where there is only one box it can have been drawn from -- the longest
    here is the longest it recorded.
    """
    own = max(r['length_mm'] for r in rows if not r['with'])
    assert round(own, 3) == db['label_leaders']['summary']['leader_length_max_mm']
    for r in rows:                      # a word's own line is never longer than its reach
        assert r['length_mm'] <= r['moves_mm'] + 1e-9


def test_where_an_end_falls_is_the_apps_own_hit_test(db, rows):
    """`tip_in` is what the app answers for a click at that point, and no more.

    The one thing it must not do is claim a region that does not hold the point: every
    named answer is checked back against the extents it came from.
    """
    RE = db['region_extents']['data']
    for r in rows:
        for at, where in (('box', r['word_in']), ('tip', r['tip_in'])):
            if where in (L.NONE, L.UNASS, L.OFF):
                continue
            x, y = r[at][:2]
            for ab in where.split('/'):
                assert sum(A.pip(g, x, y) for g in RE[str(r['plate'])][ab]['g']) % 2


def test_the_tips_land_where_the_atlas_says_they_do(rows, db):
    """179 of the 240 land in the region their label names.

    Of the rest, 35 land in no region at all -- an unassigned face, or an outline too
    thin to hold the point that seeded it -- and 26 in a neighbor's ground. Five of
    those 26 are names that name no region: a fissure is the line between two regions
    (see `features`), so a line drawn to one lands in whichever of them holds the point.

    It was 177/9/54 while `MIN_AREA_PX` stood at 600: seventeen of those tips sat in the
    middle of a face too small to publish, and came back to their own region when the
    floor came down to `MIN_FACE_PX`.

    The other 28 are tips a row of `seed_overrides` supersedes, and they show here
    precisely because they were fixed. Three are marks the pass misread -- 4Sh and 4N on
    plate 39, Sp5O on 51; three more are EPlA on plates 5, 6 and 8, where the march
    stopped a real line short of its end on 5 and 6 and followed the neighboring MiA
    leader on 8; one is the right VMHSh on 30, a real line the march followed to two
    pixels short of the shell it points into; fourteen are the joined E/OV label on
    plates 7, 9, 14 and 15, where the march stopped each line short of the olfactory
    ventricle it is drawn to and both names of the label carry the same stopped tip;
    three are on plate 1, where both IPl lines end on the wall between the two laminae
    the atlas draws there and the left aci line ends in the granule layer beside the
    tract; one is the left aci on plate 2, whose line ends in the internal plexiform
    ring IPl is printed in, 88 page px short of the tract down the core of the bulb the
    line is drawn into; and three are on plate 3, where the right GrA and aci lines stop
    22 plate px short of the slit and the sheath at the head of the olfactory ventricle
    and the left aci line stops 11 short of the same sheath, all three out in the granule
    layer. In every case the extents no longer follow the recorded tip, so the tip is
    left visibly sitting in the neighbor it used to take ground from. A tip in a neighbor
    that is neither a feature nor superseded is a new one of these.

    38 in none rather than 35 since the section outline moved onto the drawn line
    (tools/build_brain_outline.py): three tips sit on the section's edge -- IPl on plate
    6 in the paper beside the bulb, cu on 54 on the outer line itself, LRt on 56 a pixel
    outside it -- where the photograph's edge used to reach out and take them in. Each
    region keeps its area on that plate from its other seeds.

    30 in a neighbor rather than 26, and 172 in their own rather than 176: the three
    plate-1 tips above and the left aci tip on plate 2, each of which used to land in the
    region it names because that region was holding ground the drawing gives its neighbor.

    33 in a neighbor rather than 30, 170 in their own rather than 172 and 37 in none
    rather than 38: the three plate-3 tips above. GrA's and the left aci's used to land
    in the region they name, because each was holding the granule core it stopped in;
    the right aci's used to fall in the seam between GrA and GrO there, which no polygon
    covered. All three now sit in the GrO the drawing gives that core.

    195 in their own rather than 170, 35 in a neighbor rather than 33 and 10 in none
    rather than 37, with the series re-cut at a `MIN_FACE_PX` of 100. The floor came down
    from 400 with the atlas deliberately not re-cut, so the plates took it on the next
    rebuild a correction ran over them (20260922T135037Z). Twenty-six tips that fell in no
    region now fall in the one they name, and every one of them is on a plate no input of
    this repository touched -- Mi on 4 and 7, dlo on 5 and 8, lo on 6, both aci lines on 8
    and on 9, GlA on 10, E and OV on 12, ICj and LSD on 19, E and ICj on 22, both eml lines
    on 28, VMHSh on 29, alv on 31, MVPO on 47, DCMo on 48, 7DM and PPy on 50, Bo on 52 and
    IB on 57 -- so the floor is what moved them. Fourteen of those names had no entry on
    that plate at all before; the other twelve had one that did not reach the tip.

    The remaining two moves are plate 1's own fix. The right Mi tip lands in EPl rather
    than in Mi: it used to sit in the bite Mi's seed took out of the external plexiform
    band, and that bite is what the correction gave back, closing EPl into a ring. The
    right aci tip lands in GrO rather than in no region: it used to sit in an unassigned
    face inside the granule core, which is the core's again now that GrO is seeded on its
    printed word. Both rows are superseded, so the list below gains (1, 'Mi') and a second
    (1, 'aci').

    190 in their own rather than 195 and 40 in a neighbor rather than 35, with the bulb
    laminae of plates 2 and 3 given to the names whose lines end in them
    (20260923T145926Z). Both IPl lines on each of the two plates and the right Mi line on
    plate 3 now sit in Mi or in the granule core rather than in IPl: each used to land in
    the region it names because IPl was holding the outer lamina the drawing gives Mi, and
    the right Mi tip on 3 was read 23 plate px short of the bulb, out in the glomerular
    layer it took a bite of. All five rows are superseded, so the list below gains
    (2, 'IPl') twice, (3, 'IPl') twice and (3, 'Mi').
    """
    where = {k: [r for r in rows if L.lands(r) == k] for k in ('own', 'other', 'none')}
    assert (len(where['own']), len(where['other']), len(where['none'])) == (190, 40, 10)
    for r in where['other']:
        assert r['feature'] or r['superseded_by'], (r['plate'], r['abbr'], r['index'])
    assert sorted((r['plate'], r['abbr']) for r in where['other'] if r['superseded_by']) == \
        [(1, 'IPl'), (1, 'IPl'), (1, 'Mi'), (1, 'aci'), (1, 'aci'),
         (2, 'IPl'), (2, 'IPl'), (2, 'aci'),
         (3, 'GrA'), (3, 'IPl'), (3, 'IPl'), (3, 'Mi'), (3, 'aci'), (3, 'aci'),
         (5, 'EPlA'), (6, 'EPlA'),
         (7, 'E'), (7, 'E'), (7, 'OV'), (7, 'OV'), (8, 'EPlA'), (9, 'E'), (9, 'OV'),
         (14, 'E'), (14, 'E'), (14, 'OV'), (14, 'OV'),
         (15, 'E'), (15, 'E'), (15, 'OV'), (15, 'OV'),
         (30, 'VMHSh'), (39, '4N'), (39, '4Sh'), (51, 'Sp5O')]


def test_the_figures_methods_publishes_come_back(rows):
    """METHODS quotes two numbers about the gap the leaders close; these are them.

    "the two are a median 0.57 mm apart, a fifth of them over a millimeter" -- the
    distance from the center of the printed word to the tip, over all 240 labels.
    """
    import statistics
    moves = [r['moves_mm'] for r in rows]
    assert round(statistics.median(moves), 2) == 0.57
    assert sum(1 for m in moves if m > 1.0) == 47          # 47 of 240, a fifth


def test_filters(db, rows):
    class Args:
        abbr = plates = None
        shared = odd = False
        min_mm = 0.0
        sort = 'plate'
        limit = 0

    a = Args()
    assert L.select(rows, a, db) == rows
    a.shared = True
    assert len(L.select(rows, a, db)) == 42            # 21 lines, two names each
    a.shared, a.odd = False, True
    assert len(L.select(rows, a, db)) == 50            # 40 in a neighbor, 10 in none
    a.odd, a.abbr = False, 'VMHSh'
    assert {r['abbr'] for r in L.select(rows, a, db)} == {'VMHSh'}
    a.abbr = 'auditory cortex'                         # an alias resolves to its members
    assert L.expand(db, a.abbr) == {'Au1', 'AuD', 'AuV', 'A1', 'AAF'}
    a.abbr, a.sort, a.limit = None, 'length', 3
    top = L.select(rows, a, db)
    assert len(top) == 3 and top == sorted(top, key=lambda r: -r['length_mm'])
    a.sort, a.limit, a.min_mm = 'plate', 0, 1.0
    assert all(r['length_mm'] >= 1.0 for r in L.select(rows, a, db))
    with pytest.raises(SystemExit):
        L.expand(db, 'not a structure')


def test_the_flat_files_carry_every_row(rows):
    import csv
    import io
    import json
    text = L.table(rows)
    assert text.endswith('\r\n')
    got = list(csv.DictReader(io.StringIO(text)))
    assert len(got) == len(rows) and list(got[0]) == L.COLS
    assert got[0]['line'].startswith('p')              # never a date to a spreadsheet
    lines = json.loads(L.as_json(rows))
    assert len(lines) == 219
    assert sum(len(g['labels']) for g in lines) == len(rows)


def test_plate_filter_reads_one_plate(db):
    only = L.leaders(db, [30])
    assert {r['plate'] for r in only} == {30}
    assert len(only) == 7
    assert math.isclose(max(r['length_mm'] for r in only), 0.47, abs_tol=0.01)
