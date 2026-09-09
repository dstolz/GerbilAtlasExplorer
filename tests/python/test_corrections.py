"""tools/corrections.py: a correction read in from the plate view, against the extraction.

The fixture is the S1DZ case of #77 on plate 19 -- a seed inside the strip and the 30 px
run of dashed boundary the tracing had missed -- as matlab/AtlasRegionFix.m would have
written it. The committed tracing carries that run now, so against it the seed already
lands in S1DZ and the boundary is already on ink; what the tests check is that the tool
reads the file, says so, and writes what the pipeline reads back.
"""
import math
import os

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
