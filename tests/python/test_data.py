"""The database's own promises, as tests over the committed data/gerbil_atlas.json.

Every number here is one METHODS.md states in prose; a change that breaks one of them
is either a regression or a change METHODS has to record.
"""
import json
import os

import pytest

import atlaslib as A


@pytest.fixture(scope='module')
def db():
    return A.load_db()


def test_structures(db):
    S = db['structures']
    assert len(S) == 723
    abbrs = [s['abbr'] for s in S]
    assert len(set(abbrs)) == 723
    assert len({s['name'] for s in S}) == 723
    for s in S:
        assert s['plates'] == sorted(s['plates'])
        assert s['first_plate'] == s['plates'][0] and s['last_plate'] == s['plates'][-1]
        assert s['n_plates'] == len(s['plates'])
        assert all(1 <= p <= A.N_PLATES for p in s['plates'])
        assert s['systems'], s['abbr']


def test_plates(db):
    P = db['plates']
    assert [p['plate'] for p in P] == list(range(1, A.N_PLATES + 1))
    for k, p in enumerate(P):
        assert p['bregma'] == pytest.approx(7.80 - 0.35 * k, abs=1e-9)
        assert p['lambda_'] == pytest.approx(p['bregma'] + 4.45, abs=1e-9)
        assert p['interaural'] == pytest.approx(p['bregma'] + 7.25, abs=1e-9)
        assert p['occipital_crest'] == pytest.approx(p['bregma'] + 9.95, abs=1e-9)
    # the per-plate counts the database carries are the counts the data gives
    count = {}
    for s in db['structures']:
        for p in s['plates']:
            count[p] = count.get(p, 0) + 1
    for p in P:
        boxes = db['label_positions']['data'].get(str(p['plate']), {})
        assert p['n_structures'] == count.get(p['plate'], 0)
        assert p['n_labels_located'] == sum(len(v) for v in boxes.values())
        assert p['ocr_confirmed'] == sorted(boxes)


def test_label_positions(db):
    S = {s['abbr'] for s in db['structures']}
    LP = db['label_positions']['data']
    assert sorted(map(int, LP)) == list(range(1, A.N_PLATES + 1))
    n = 0
    for p, d in LP.items():
        for ab, boxes in d.items():
            assert ab in S, (p, ab)
            for b in boxes:
                assert len(b) == 4 and all(0 <= v <= 1 for v in b)
                n += 1
    assert n == db['verification']['label_positions_located'] == 6266
    assert sum(len(d) for d in LP.values()) == db['verification']['ocr_confirmed'] == 3298


def test_leaders(db):
    LP = db['label_positions']['data']
    n = 0
    for p, d in db['label_leaders']['data'].items():
        for ab, tips in d.items():
            assert ab in LP[p], (p, ab)
            for i, x, y in tips:
                assert 0 <= i < len(LP[p][ab])
                assert 0 <= x <= 1 and 0 <= y <= 1
                n += 1
    assert n == db['label_leaders']['summary']['leaders_found'] == 215


def test_region_extents(db):
    R = db['region_extents']
    S = {s['abbr'] for s in db['structures']}
    LP = db['label_positions']['data']
    entries = polys = pts = 0
    for p, d in R['data'].items():
        for ab, e in d.items():
            assert ab in S and ab in LP[p], (p, ab)
            assert len(e['g']) == len(e['s'])
            assert e['a'] > 0 and e['n'] >= 1
            entries += 1
            polys += len(e['g'])
            pts += sum(len(g) for g in e['g'])
            for g in e['g']:
                assert g[0] == g[-1] and len(g) >= 4
    sm = R['summary']
    assert (entries, polys, pts) == (sm['structure_plate_entries'], sm['polygons'], sm['points'])
    assert sm['boundary_edges_shared_exactly'] == 1.0
    assert sm['label_inside_its_own_region'] >= 0.97
    assert sm['section_area_residual_worst_plate'] <= 0.05


def test_shared_edges_recomputed(db):
    """Every directed boundary edge has its reverse in exactly one neighbour: the regions
    tile the section. Recomputed here rather than trusted from the summary."""
    import build_region_extents as B
    R = db['region_extents']
    out = B.check_shared_edges(R['data'], R['unassigned'])
    val = out['boundary_edges_shared_exactly'] if isinstance(out, dict) else out
    assert val == 1.0


def test_brain_outline(db):
    fr = A.Frame(db['plate_frame'])
    O = db['brain_outline']['data']
    assert sorted(map(int, O)) == list(range(1, A.N_PLATES + 1))
    top, bottom, rings = -99, 99, 0
    for p, gs in O.items():
        for g in gs:
            assert len(g) >= 3
            rings += 1
            for x, y in g:
                dv = fr.dv_f(y)
                top, bottom = max(top, dv), min(bottom, dv)
    assert rings == 81
    assert -0.1 <= top <= 0.0          # reaches the dorsal plane, never crosses it
    assert -9.2 <= bottom <= -9.0      # just below the deepest printed label


def test_labels_inside_outline(db):
    """97.8% of printed labels fall inside their plate's outline (METHODS)."""
    fr = A.Frame(db['plate_frame'])
    O = db['brain_outline']['data']
    inside = total = 0
    for p, d in db['label_positions']['data'].items():
        polys = [[(fr.ml_f(x), fr.dv_f(y)) for x, y in g] for g in O[p]]
        tips = db['label_leaders']['data'].get(p, {})
        for ab, boxes in d.items():
            tip = {t[0]: (t[1], t[2]) for t in tips.get(ab, [])}
            for i, b in enumerate(boxes):
                x, y = tip.get(i, (b[0], b[1]))
                pt = (fr.ml_f(x), fr.dv_f(y))
                total += 1
                if any(A.pip(g, *pt) for g in polys):
                    inside += 1
    assert inside / total >= 0.975


def test_aliases_and_blocks(db):
    S = {s['abbr'] for s in db['structures']}
    for k, v in db['aliases'].items():
        assert v and all(t in S for t in v), k
    for p, groups in db['label_blocks']['data'].items():
        for g in groups:
            assert len(g) >= 2 and all(ab in S for ab in g), (p, g)


def test_plate_registration_matches_vec(db):
    vec = A.load_vec()
    reg = db['plate_registration']['data']
    assert sorted(map(int, reg)) == list(range(1, A.N_PLATES + 1))
    for k, m in reg.items():
        assert m == vec[k]['m']
        a, b, c, d = m[:4]
        assert a * d - b * c > 0                      # a rotation, not a reflection
        assert abs(abs(a) + abs(b) - 0.3996) < 0.002  # the shared scale, whichever way round


def test_version(db):
    v = db['version']
    assert v['schema'] and v['version'] and v['generated']


def test_plate_images():
    from PIL import Image
    for kind in A.KINDS:
        for p in range(1, A.N_PLATES + 1):
            path = A.plate_path(kind, p)
            assert os.path.exists(path), path
            with Image.open(path) as im:
                assert im.size == (A.NW, A.NH), path


def test_volumes_consistent(db):
    with open(A.VOLUMES, encoding='utf8') as f:
        V = json.load(f)
    R = db['region_extents']['data']
    have = {ab for d in R.values() for ab in d}
    assert set(V['data']) == have
    assert V['summary']['structures'] == len(V['data']) == 697
    assert 'little-endian' in V['note']
    for ab, e in V['data'].items():
        assert e['grade'] in ('surface', 'slab')
        assert e['bounding'] == (e['grade'] == 'slab')
        m = e['mesh']
        assert m['fw'] in (2, 4) and m['nv'] > 0 and m['nf'] > 0
