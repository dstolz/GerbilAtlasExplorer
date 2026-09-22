"""tools/corrections.py: a correction read in from the plate view, against the extraction.

The fixture is the S1DZ case of #77 on plate 19 -- a seed inside the strip and the 30 px
run of dashed boundary the tracing had missed -- as matlab/AtlasRegionFix.m would have
written it. The committed tracing carries that run now, so against it the seed already
lands in S1DZ and the boundary is already on ink; what the tests check is that the tool
reads the file, says so, and writes what the pipeline reads back.
"""
import math
import os

import pytest

import atlaslib as A
import build_region_extents as B
import corrections as C

FIX = os.path.join(os.path.dirname(__file__), 'fixtures', 'correction_p19_S1DZ.json')


def _seg_dist(q, a, b):
    ax, ay = a
    bx, by = b
    vx, vy = bx - ax, by - ay
    L2 = vx * vx + vy * vy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((q[0] - ax) * vx + (q[1] - ay) * vy) / L2))
    return math.dist(q, (ax + t * vx, ay + t * vy))


def test_fixture_reads():
    c = C.load(FIX)
    assert c['plate'] == 19 and c['abbr'] == 'S1DZ'
    assert len(c['seeds']) == 1 and len(c['boundaries']) == 1 and c['extents'] == []


def test_path_d_is_the_polyline_flatten_reads():
    pts = [(1162.0, 1043.0), (1174.5, 1052.25), (1186.0, 1061.0)]
    d = C.path_d(pts)
    assert d.startswith('M 1162 1043 C ') and ' L ' not in d
    flat, closed = B.flatten(d)
    assert closed is False
    for q in pts:                               # every vertex survives
        assert min(math.dist(q, f) for f in flat) < 1e-9
    for f in flat:                              # and every sample is on a segment, to the
        assert min(_seg_dist(f, a, b) for a, b in zip(pts, pts[1:])) < 0.01   # two decimals written
    (pts2, c2), = A.flatten(d)                  # the shared reader agrees on the ends
    assert c2 is False and pts2[0] == pts[0] and pts2[-1] == pts[-1]
    assert C.path_d(pts, closed=True).endswith(' Z')


def test_plan_names_the_box_and_the_group():
    DB = A.load_db()
    c = C.load(FIX)
    P, paths, rows = C.plan(c, DB, A.vec_matrices())
    assert [g for g, _d, _n in paths] == ['outlines-dashed']
    assert paths[0][1] == C.path_d([(1162.0, 1043.0), (1186.0, 1061.0)])
    (ab, row), = rows
    assert ab == 'S1DZ'
    i, fx, fy, cid, why = row
    assert i == -1 and cid == c['id'] and why               # a seed of its own: no box withdraws
    assert P.fr.ml_f(fx) < 0
    import copy
    c2 = copy.deepcopy(c)
    c2['seeds'][0]['label_index'] = 0                      # ...unless the file says which box
    _P, _paths, rows2 = C.plan(c2, DB, A.vec_matrices())
    assert rows2[0][1][0] == 0
    c2['seeds'][0]['label_index'] = 5                      # and that box has to exist
    import pytest
    with pytest.raises(SystemExit):
        C.plan(c2, DB, A.vec_matrices())
    assert C.seed_point(c['seeds'][0], P) == tuple(c['seeds'][0]['page_px'])
    ml, dv = P.page_to_mm(*c['seeds'][0]['page_px'])      # the mm beside the page px agree
    assert max(abs(ml - c['seeds'][0]['mm'][0]), abs(dv - c['seeds'][0]['mm'][1])) < 1e-3


def test_frames_that_disagree_are_refused():
    import copy
    import pytest
    DB = A.load_db()
    c = copy.deepcopy(C.load(FIX))
    c['seeds'][0]['mm'][0] += 0.1                          # a tenth of a millimetre off
    with pytest.raises(SystemExit):
        C.validate(c, DB, A.vec_matrices())


def test_committed_corrections_read():
    """Every file in corrections/ still reads against the database it was written for."""
    import glob
    DB = A.load_db()
    VECM = A.vec_matrices()
    for f in sorted(glob.glob(os.path.join(C.CORRDIR, '*.json'))):
        C.validate(C.load(f), DB, VECM)


def test_apply_dry_run_touches_nothing():
    import copy
    DB = A.load_db()
    before_over = copy.deepcopy(DB['seed_overrides']['data'])
    with open(A.JSON, encoding='utf8', newline='') as f:
        before_db = f.read()
    svg = os.path.join(A.SVGDIR, 'GerbilAtlas_Plate_19.svg')
    with open(svg, encoding='utf8', newline='') as f:
        before_svg = f.read()
    rep = C.apply(C.load(FIX), DB, A.vec_matrices(), dry=True, quiet=True)
    assert rep['added'] == 1 and rep['changed'] == 1
    assert DB['seed_overrides']['data'] == before_over     # whatever is committed, unchanged
    with open(A.JSON, encoding='utf8', newline='') as f:
        assert f.read() == before_db
    with open(svg, encoding='utf8', newline='') as f:
        assert f.read() == before_svg


def test_inspect_reads_the_seed_against_the_extraction():
    DB = A.load_db()
    rep = C.inspect(C.load(FIX), DB, A.vec_matrices(), quiet=True)
    (s,) = rep['seeds']
    assert s['owner'] == 'S1DZ'                 # the case is fixed: the seed lands home
    assert 'S1DZ' in s['face_names'] and s['box'] == 0     # the left box is the nearest
    (b,) = rep['boundaries']
    assert b['style'] == 'outlines-dashed' and all(b['ends_bridge'])
    assert b['on_ink'] > 0.9                    # the run is traced now (#77)
    assert any('already traced' in ln for ln in rep['lines'])


PLATE, ABBR = 19, 'S1DZ'


def _ring_page(DB, plate=PLATE, abbr=ABBR, ring=0):
    """One ring of a region as the extraction cut it, in page px -- what the page's
    Drop writes: the piece the cut made, not a hand-drawn guess at it."""
    P = C.Plate(DB, A.vec_matrices(), plate)
    g = DB['region_extents']['data'][str(plate)][abbr]['g'][ring]
    return P, [[round(v, 2) for v in C.xf(P.im, fx * P.NW, fy * P.NH)] for fx, fy in g[:-1]]


def _extent_doc(P, page, kind, plate=PLATE, abbr=ABBR):
    """A correction carrying one extent of that kind, with the mm the page writes
    beside the page px -- which is what check_frames holds it to."""
    return {'schema': C.SCHEMA, 'id': 'test-%s-%s' % (kind, abbr), 'plate': plate,
            'abbr': abbr, 'problem': 'a test of the %s kind.' % kind,
            'seeds': [], 'boundaries': [], 'notes': [],
            'extents': [{'abbr': abbr, 'kind': kind, 'page_px': page,
                         'mm': [[round(v, 3) for v in P.page_to_mm(*q)] for q in page],
                         'note': ''}]}


def _pulled_in(page, px=40.0):
    """The same ring pulled in towards its middle, so its outline is off the traced ink."""
    cx = sum(q[0] for q in page) / len(page)
    cy = sum(q[1] for q in page) / len(page)
    out = []
    for x, y in page:
        d = max(1e-9, math.dist((x, y), (cx, cy)))
        t = max(0.05, (d - px) / d)
        out.append([round(cx + (x - cx) * t, 2), round(cy + (y - cy) * t, 2)])
    return out


def test_a_negative_extent_reads_and_is_never_traced():
    """A ring dropped in the page says the region has no area there. It validates like
    any extent, inspect says what holds it and what put it there, and apply traces
    nothing of it -- where the same outline drawn positive would be inked wherever it
    lies off the tracing."""
    DB = A.load_db()
    VECM = A.vec_matrices()
    P, page = _ring_page(DB)
    c = _extent_doc(P, page, 'negative')
    C.validate(c, DB, VECM)
    assert C.extent_kind(c['extents'][0]) == 'negative'
    assert C.extent_kind({}) == 'positive'                  # a file from before the kind

    _P, paths, rows = C.plan(c, DB, VECM)
    assert paths == [] and rows == []                       # nothing inked, nothing seeded
    off = _pulled_in(page)                                  # an outline off the ink
    _P, drawn, _r = C.plan(_extent_doc(P, off, 'positive'), DB, VECM)
    assert drawn and all(n.startswith('extent of S1DZ') for _g, _d, n in drawn)
    _P, drawn_neg, _r = C.plan(_extent_doc(P, off, 'negative'), DB, VECM)
    assert drawn_neg == []                                  # the same outline, never inked

    rep = C.inspect(c, DB, VECM, quiet=True)
    (e,) = rep['extents']
    assert e['kind'] == 'negative' and e['abbr'] == ABBR
    assert e['share_held'] > 0.9                            # the ring is S1DZ's own today
    assert 0.3 < e['share_of_region'] < 0.8                 # one of its two rings
    assert any('S1DZ negative' in ln for ln in rep['lines'])
    assert any('seeds this' in ln or 'reached in' in ln for ln in rep['lines'])


def test_a_ring_off_the_ink_along_the_section_edge_is_said_to_be_so():
    """A ring is cut inside `brain_outline`, which follows the tissue edge wherever the
    atlas draws no line along it, so part of a ring can lie well off the traced ink and
    still be exactly where the extraction put it. `inspect` says which runs those are,
    rather than leaving a reader to read every one as a line the tracing missed."""
    DB = A.load_db()
    P, page = _ring_page(DB, abbr='Cg1')            # its dorsal edge on plate 19
    rep = C.inspect(_extent_doc(P, page, 'negative', abbr='Cg1'), DB, A.vec_matrices(),
                    quiet=True, before=None)
    said = [ln for ln in rep['lines'] if 'off the traced ink' in ln]
    assert len(said) == 1 and 'along the section outline' in said[0]
    assert rep['extents'][0]['runs']                # and the runs are still reported


def test_an_extent_of_no_known_kind_is_refused():
    import pytest
    DB = A.load_db()
    P, page = _ring_page(DB)
    c = _extent_doc(P, page, 'maybe')
    with pytest.raises(SystemExit):
        C.validate(c, DB, A.vec_matrices())


def test_qc_draws_the_site_before_and_after(tmp_path, monkeypatch):
    """--qc writes the plate and the site: two panels when the ref reads, one when it
    does not, and the plate picture the same either way."""
    from PIL import Image
    monkeypatch.setattr(A, 'QCDIR', str(tmp_path))
    DB, VECM, c = A.load_db(), A.vec_matrices(), C.load(FIX)
    rep = C.inspect(c, DB, VECM, want_qc=True, quiet=True, before='HEAD')
    assert os.path.basename(rep['qc']) == 'chk_corr_%s.png' % c['id']
    assert os.path.basename(rep['site']) == 'chk_corr_%s_site.png' % c['id']
    with Image.open(rep['site']) as im:
        assert im.width == 2 * C.SITE_PANEL_PX + 12          # before HEAD, and after
    plate = open(rep['qc'], 'rb').read()
    rep = C.inspect(c, DB, VECM, want_qc=True, quiet=True, before='no-such-ref')
    with Image.open(rep['site']) as im:
        assert im.width == C.SITE_PANEL_PX                   # the one panel
    assert any('not a ref' in ln for ln in rep['lines'])
    assert open(rep['qc'], 'rb').read() == plate


# ---- report and rebase: the arithmetic, on databases made here

def _db(entries, frame=None):
    """A database with just enough in it for entries_diff, hemispheres and series:
    entries is {(plate, abbr): (area, [ring lengths])}."""
    R = {}
    for (p, ab), (a, rings) in entries.items():
        R.setdefault(str(p), {})[ab] = {'a': a, 'g': [[[0.1 * i, 0.1] for i in range(n)] for n in rings],
                                        's': [1.0] * len(rings), 'n': 1}
    return {'region_extents': {'data': R, 'summary': {}}, 'plate_frame': frame or A.load_db()['plate_frame'],
            'seed_overrides': {'note': 'n', 'data': {}}, 'label_positions': {'note': 'n', 'data': {}},
            'brain_outline': {'note': 'n', 'data': {}}, 'label_leaders': {'note': 'n', 'data': {}},
            'label_blocks': {'note': 'n', 'data': {}}}


def test_entries_diff_reads_area_and_rings_not_noise():
    a = _db({(3, 'E'): (0.0669, [4, 4]), (3, 'GrA'): (1.1383, [5]), (28, 'RAPir'): (0.1432, [4, 4])})
    b = _db({(3, 'E'): (0.1008, [4, 4, 4]), (3, 'GrA'): (1.1383, [5]), (28, 'RAPir'): (0.1432, [4, 4])})
    d = C.entries_diff(a, b)
    assert list(d) == [(3, 'E')]                            # GrA and RAPir did not move
    before, after = d[(3, 'E')]
    assert before['a'] == 0.0669 and after['a'] == 0.1008
    b['region_extents']['data']['3']['GrA']['a'] = 1.1382    # the fourth decimal moved: it counts
    assert (3, 'GrA') in C.entries_diff(a, b)
    del b['region_extents']['data']['28']['RAPir']           # an entry that went counts
    assert C.entries_diff(a, b)[(28, 'RAPir')][1] is None


def test_hemispheres_split_by_the_side_of_the_midline():
    fr = A.Frame(A.load_db()['plate_frame'])
    xl = fr.x(-4.0) / fr.w                                    # a square on the left, ML -4
    xr = fr.x(+4.0) / fr.w                                    # and one twice the size on the right
    sq = lambda cx, h: [[cx - h, 0.5 - h], [cx + h, 0.5 - h], [cx + h, 0.5 + h], [cx - h, 0.5 + h]]
    e = {'a': 0.3, 'g': [sq(xl, 0.01), sq(xr, 0.01 * 2 ** 0.5)], 's': [1, 1], 'n': 2}
    left, right = C.hemispheres(e, fr)
    assert abs(left - 0.1) < 1e-3 and abs(right - 0.2) < 1e-3
    assert C.hemispheres(None, fr) == (0.0, 0.0)


def test_input_delta_is_per_plate_and_tells_a_note_apart():
    a = _db({})
    b = _db({})
    b['seed_overrides']['data'] = {'3': {'E': [[-1, 0.5, 0.5, 'x', 'why']]}}
    b['label_positions']['data'] = {'17': {'1': [[0.5, 0.5, 0.01, 0.01]]}}
    keys, notes = C.input_delta(a, b)
    assert keys == {'seed_overrides': {'3'}, 'label_positions': {'17'}} and notes == set()
    b['seed_overrides']['note'] = 'a paragraph per correction'
    keys, notes = C.input_delta(a, b)
    assert notes == {'seed_overrides'}
    assert C.input_delta(b, b) == ({}, set())


def test_report_against_a_ref_this_checkout_has(tmp_path):
    """The committed correction, against HEAD: nothing moves, and the report says so
    in the shape the write-up pastes."""
    DB = A.load_db()
    c = C.load(C.resolve('20260908T142315Z-p28-RAPir'))
    md, rep = C.report(c, DB, A.vec_matrices(), against='HEAD')
    assert rep['moved'] == [] and rep['volumes_moved'] == []
    assert '| `RAPir`, plate 28 |' in md and 'No other (plate, region) entry moves' in md
    assert rep['region']['after']['a'] == DB['region_extents']['data']['28']['RAPir']['a']
    assert rep['summary']['boundary_edges_shared_exactly'] == (1.0, 1.0)
    c2 = dict(c, preview={'area_mm2_before': 0.1432, 'area_mm2': rep['region']['after']['a'], 'changed': ['RAPir']})
    md2, rep2 = C.report(c2, DB, A.vec_matrices(), against='HEAD')
    assert rep2['preview_agrees'] and 'the re-cut here agrees' in md2
    md3, _rep3 = C.report(c, DB, A.vec_matrices(), against='no-such-ref')
    assert 'not a ref this checkout can read' in md3


# ---- rebase: METHODS.md, whose prose is authored and whose marked numbers are derived

POLY = '<!-- n:region_extents.summary.polygons -->%s<!-- /n -->'
FACES = '<!-- n:region_extents.summary.faces_named_by_one_abbreviation -->%s<!-- /n -->'


def test_methods_conflict_in_marked_numbers_only_takes_the_merged_in_side():
    """The shape #146 and #147 both stopped on: the same line on both sides, a marked
    number apart. CRLF, as a Windows checkout writes it, and a diff3 base section."""
    txt = '\r\n'.join(['# Methods',
                       '<<<<<<< HEAD',
                       'cut as ' + POLY % '5,829' + ' polygons.',
                       '=======',
                       'cut as ' + POLY % '5,831' + ' polygons.',
                       '>>>>>>> origin/main',
                       'prose between',
                       '<<<<<<< HEAD',
                       FACES % '3,450' + ' faces',
                       '||||||| merged common ancestors',
                       FACES % '3,449' + ' faces',
                       '=======',
                       FACES % '3,452' + ' faces',
                       '>>>>>>> origin/main',
                       '======= a setext rule outside a hunk is prose', ''])
    out, hunks, prose = C.resolve_marked_numbers(txt)
    assert (hunks, prose) == (2, [])
    assert out == ('# Methods\r\ncut as ' + POLY % '5,831' + ' polygons.\r\nprose between\r\n'
                   + FACES % '3,452' + ' faces\r\n======= a setext rule outside a hunk is prose\r\n')


def test_methods_conflict_in_prose_is_left_to_a_person():
    both = ('<<<<<<< HEAD\n' + 'cut as ' + POLY % '5,829' + ' polygons.\n'
            '=======\n' + 'cut as ' + POLY % '5,831' + ' polygons.\n' + '>>>>>>> origin/main\n')
    worded = ('\n<<<<<<< HEAD\n' + 'cut as ' + POLY % '5,829' + ' polygons.\n'
              '=======\n' + 'drawn as ' + POLY % '5,831' + ' polygons.\n' + '>>>>>>> origin/main\n')
    assert C.resolve_marked_numbers(both + worded) == (None, 2, [7])
    rekeyed = ('<<<<<<< HEAD\n' + POLY % '5,829' + '\n=======\n' + FACES % '5,829'
               + '\n>>>>>>> origin/main\n')         # a marker that names another field is prose
    assert C.resolve_marked_numbers(rekeyed) == (None, 1, [1])
    assert C.resolve_marked_numbers('no hunk\n') == (None, 0, [])
    assert C.resolve_marked_numbers(both[:-len('>>>>>>> origin/main\n')])[0] is None


BASE_METHODS = ''.join(
    ['# Methods\n', '\n', 'The regions are cut as %s polygons.\n']
    + ['A line of prose, %d.\n' % i for i in range(6)]
    + ['| faces named by one abbreviation | %s |\n']
    + ['A line of prose, %d.\n' % i for i in range(6, 12)]
    + ['%s\n'])


def _methods(polygons, faces, closing='The closing paragraph.', cut='cut'):
    return BASE_METHODS.replace('cut as', cut + ' as') % (POLY % polygons, FACES % faces, closing)


@pytest.mark.parametrize('style', ['merge', 'diff3', 'zdiff3'])
@pytest.mark.parametrize('worded', [False, True])
def test_methods_conflict_as_git_writes_it(tmp_path, monkeypatch, style, worded):
    """A real merge: the branch moves the numbers and rewrites a paragraph clear of
    them, main moves the same numbers -- and, for `worded`, rewords the sentence one of
    them sits in. Numbers only: main's numbers and the branch's paragraph, and the file
    is no longer unmerged. Worded: nothing is touched and it is still unmerged."""
    import subprocess

    def git(*args):
        return subprocess.run(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', '-c',
                               'commit.gpgsign=false', '-c', 'merge.conflictStyle=' + style]
                              + list(args), cwd=str(tmp_path), check=False,
                              capture_output=True, text=True).stdout

    def write(text):
        with open(os.path.join(str(tmp_path), 'METHODS.md'), 'w', encoding='utf8', newline='') as f:
            f.write(text)
    git('init', '-q', '-b', 'main')
    git('config', 'core.autocrlf', 'false')
    write(_methods('5,829', '3,450'))
    git('add', '-A')
    git('commit', '-qm', 'base')
    git('checkout', '-qb', 'correction/x')
    write(_methods('5,831', '3,452', closing='The closing paragraph, as the branch has it.'))
    git('commit', '-qam', 'the branch')
    git('checkout', '-q', 'main')
    write(_methods('5,830', '3,451', cut='drawn' if worded else 'cut'))
    git('commit', '-qam', 'main')
    git('checkout', '-q', 'correction/x')
    git('merge', '--no-commit', '--no-ff', 'main')
    assert git('diff', '--name-only', '--diff-filter=U').split() == ['METHODS.md']
    with open(os.path.join(str(tmp_path), 'METHODS.md'), encoding='utf8', newline='') as f:
        left = f.read()
    monkeypatch.setattr(A, 'ROOT', str(tmp_path))
    done, hunks, prose = C._resolve_marked_numbers('METHODS.md')
    with open(os.path.join(str(tmp_path), 'METHODS.md'), encoding='utf8', newline='') as f:
        now = f.read()
    unmerged = git('diff', '--name-only', '--diff-filter=U').split()
    if worded:
        assert not done and prose and now == left and unmerged == ['METHODS.md']
    else:
        assert done and hunks >= 1 and prose == [] and unmerged == []
        assert now == _methods('5,830', '3,451', closing='The closing paragraph, as the branch has it.')
        assert git('show', ':METHODS.md') == now
