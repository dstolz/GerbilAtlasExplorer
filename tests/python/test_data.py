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
    assert n == db['verification']['label_positions_located'] == 6315
    assert sum(len(d) for d in LP.values()) == db['verification']['ocr_confirmed'] == 3338


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
    assert n == db['label_leaders']['summary']['leaders_found'] == 212


def test_no_leader_tip_lands_on_another_name(db):
    """A leader ends in the region it names, never on top of a different name.

    The atlas draws a line from a label it could not fit inside its region to the
    region itself. It never ends one on another abbreviation: that ground is
    spoken for, and the word sitting there says so. So a tip inside a different
    abbreviation's printed box is a line followed too far or the wrong line
    followed at all, and it seeds the structure in its neighbor's face.

    That failure hides. While the neighbor has no label of its own the
    mis-seeded region simply holds the neighbor's face and looks right; it only
    surfaces when the neighbor is finally located, takes its own ground back,
    and leaves the first with a sliver the small-area cull then removes. `ALPO`
    on plate 44, `CC` on 60 and `pyx` on 62 were the three, and all three were
    put aside in `label_leaders.REJECT` -- so this list is empty and stays that
    way. No exceptions: a new one is a bug, not a fact about the atlas.
    """
    LP = db['label_positions']['data']
    bad = []
    for p, d in db['label_leaders']['data'].items():
        for ab, tips in d.items():
            for i, tx, ty in tips:
                for other, boxes in LP[p].items():
                    if other == ab:
                        continue
                    for j, (cx, cy, bw, bh) in enumerate(boxes):
                        if abs(tx - cx) <= bw / 2 and abs(ty - cy) <= bh / 2:
                            bad.append('plate %s: %s tip %d lands on %s[%d]'
                                       % (p, ab, i, other, j))
    assert not bad, 'leader tips ending on another structure: ' + '; '.join(bad)


def test_region_extents(db):
    R = db['region_extents']
    S = {s['abbr'] for s in db['structures']}
    LP = db['label_positions']['data']
    entries = polys = pts = nw = 0
    for p, d in R['data'].items():
        for ab, e in d.items():
            assert ab in S and ab in LP[p], (p, ab)
            assert len(e['g']) == len(e['s'])
            assert e['a'] > 0 and e['n'] >= 1
            assert set(e) <= {'g', 's', 'a', 'n', 'w'}
            if 'w' in e:
                assert e['w'] == 1
                nw += 1
            entries += 1
            polys += len(e['g'])
            pts += sum(len(g) for g in e['g'])
            for g in e['g']:
                assert g[0] == g[-1] and len(g) >= 4
    sm = R['summary']
    assert (entries, polys, pts) == (sm['structure_plate_entries'], sm['polygons'], sm['points'])
    # `w` says the entry lies only inside boundaries the atlas draws round more than one
    # name: no outline of its own, so the app circles the printed labels instead
    assert nw == sm['entries_without_a_drawn_outline']
    assert 0 < nw < entries / 2
    assert sm['boundary_edges_shared_exactly'] == 1.0
    assert sm['label_inside_its_own_region'] >= 0.97
    assert sm['section_area_residual_worst_plate'] <= 0.05



def test_labels_and_extents_are_in_step(db):
    """`region_extents` was cut from the `label_positions` this file now carries.

    Every printed box is either seeded or explicitly dropped, so the extraction's own
    two counts have to add back up to what it was handed. A pass that extends the
    labels and does not rebuild the block leaves it stale against its own inputs, and
    nothing else here notices: a stale block still tiles the section exactly, still
    passes every share and residual above, and still ships green. What it does is hand
    the delta to whoever rebuilds next, who then owns a change they did not make -- and
    a rebuild running against labels the block has never seen can cost a region its
    ground. `ALPO` on plate 44, `CC` on 60 and `pyx` on 62 lost theirs that way, to 26
    labels added four commits earlier.

    This catches the block going stale. It does not catch a region losing ground to a
    neighbor while these counts stay balanced, which is how those three were actually
    lost; that needs a per-(plate, abbreviation) diff against the commit whose labels
    the block was rebuilt from, and cannot be asserted from one snapshot.

    And it is a proxy, not proof: `labels_seeded` is the extraction's own account of
    what it was handed, so editing that number satisfies this assertion whether or not
    anything was rebuilt. If you reach this test failing during a merge, the fix is to
    regenerate `region_extents` from the merged `label_positions` and `svg/` -- never to
    reconcile the count by hand. `region_extents` is derived, like the built pages and
    the geojson, and neither parent's copy can describe merged inputs. A merge that took
    one side and balanced this arithmetic by hand reverted a plate-30 re-seed while
    passing this test, the mesh-consistency tests and CI, on 2026-09-03.
    """
    s = db['region_extents']['summary']
    boxes = sum(len(b) for d in db['label_positions']['data'].values()
                for b in d.values())
    assert s['labels_seeded'] + s['labels_dropped'] == boxes

def test_shared_edges_recomputed(db):
    """Every directed boundary edge has its reverse in exactly one neighbor: the regions
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
    """98.7% of printed labels fall inside their plate's outline (METHODS)."""
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
    # 687: one mesh per abbreviation with an extent somewhere. The 20 names that are
    # no region -- the fissures, `cbw`, the vessels; see `features` -- have no extent
    # anywhere and so no mesh, which is the point of them. 9N and 9aCb are the two
    # that joined: both are named only inside a compound label (`9/11N`, `9a,bCb`),
    # so until that label was split they had no position anywhere, hence no extent
    # and no mesh. 9bCb and 11N still have none of their own -- they share the
    # entry filed under the name their label leads with.
    # 688 rather than 687: ALPO joined when its leader stopped ending on RPO's
    # word. It had never had an extent anywhere -- its seed was inside the oval
    # RPO is printed in, so it held RPO's face until RPO was located and then
    # held nothing.
    assert V['summary']['structures'] == len(V['data']) == 688
    assert not (have & set(db['features']['data']))
    assert 'little-endian' in V['note']
    for ab, e in V['data'].items():
        assert e['grade'] in ('surface', 'slab')
        assert e['bounding'] == (e['grade'] == 'slab')
        m = e['mesh']
        assert m['fw'] in (2, 4) and m['nv'] > 0 and m['nf'] > 0


def test_nifti_labels_match_the_meshes():
    """The committed label volume names the same structures as the meshes, at the same
    voxel size and origin the meshes file records, and 0 / 65000 mean what the table says."""
    import csv
    import gzip
    import struct

    import numpy as np

    with open(A.VOLUMES, encoding='utf8') as f:
        V = json.load(f)
    raw = gzip.open(os.path.join(A.DATA, 'gerbil_atlas_labels.nii.gz'), 'rb').read()
    assert struct.unpack_from('<i', raw, 0)[0] == 348 and raw[344:348] == b'n+1\0'
    dim = struct.unpack_from('<8h', raw, 40)
    nx, ny, nz = dim[1:4]
    assert (nx, ny, nz) == (V['grid']['shape_zyx'][2], V['grid']['shape_zyx'][0], V['grid']['shape_zyx'][1])
    assert struct.unpack_from('<hh', raw, 70) == (512, 16)
    res = V['grid']['res_mm']
    assert struct.unpack_from('<8f', raw, 76)[1:4] == pytest.approx((res, res, res), abs=1e-6)
    sx, sy, sz = (struct.unpack_from('<4f', raw, o) for o in (280, 296, 312))
    assert (sx[3], sy[3], sz[3]) == pytest.approx((V['grid']['ml_mm'][0], V['grid']['ap_mm'][0], V['grid']['dv_mm'][0]), abs=1e-4)
    a = np.frombuffer(raw, dtype='<u2', offset=352, count=nx * ny * nz)
    with open(os.path.join(A.DATA, 'gerbil_atlas_labels_lut.csv'), encoding='utf8', newline='') as f:
        lut = {int(r['id']): r['abbr'] for r in csv.DictReader(f)}
    ids, counts = np.unique(a, return_counts=True)
    assert lut[0] == '' and lut[65000] == ''
    named = {lut[int(i)] for i in ids if 0 < int(i) < 65000}
    assert named == set(V['data'])
    brain = float((a > 0).sum()) * res ** 3
    assert brain == pytest.approx(V['summary']['brain_volume_mm3'], rel=0.001)
    for i, c in zip(ids, counts):
        ab = lut[int(i)]
        if ab:
            assert c * res ** 3 == pytest.approx(V['data'][ab]['volume_mm3'], rel=0.01, abs=1e-3), ab


# ---------- the gross divisions ----------
# A superstructure carries no geometry: it is a list of the atlas's own abbreviations, and
# the app derives its outline, area and mesh from the members'. So what has to hold here is
# that the lists are well formed, that they cover the atlas, and -- the one the outline
# depends on -- that the members' boundaries still cancel into closed rings when the walls
# between them are dropped. See tools/build_groups.py.

FREE_OF_ANY_DIVISION = {'acer', 'mcer', 'BV', 'rf', 'ri', 'hif'}


def test_groups_are_well_formed(db):
    G = db['groups']['data']
    S = {s['abbr'] for s in db['structures']}
    breg = A.bregma_of(db)
    assert len(G) == 20
    assert len({g['id'] for g in G}) == len(G)
    assert len({g['abbr'] for g in G}) == len(G)
    assert len({g['name'] for g in G}) == len(G)
    for g in G:
        # a label that collides with an abbreviation would make the card ambiguous
        assert g['abbr'] not in S, g['id']
        assert g['members'] and g['n_members'] == len(g['members'])
        assert len(set(g['members'])) == g['n_members'], g['id']
        assert set(g['members']) <= S, g['id']
        assert g['plates'] == sorted(set(g['plates'])) and g['plates']
        assert (g['first_plate'], g['last_plate']) == (g['plates'][0], g['plates'][-1])
        assert g['n_plates'] == len(g['plates'])
        assert g['bregma_anterior'] == pytest.approx(max(breg[p] for p in g['plates']))
        assert g['bregma_posterior'] == pytest.approx(min(breg[p] for p in g['plates']))
        assert g['note'] and g['name'] and g['alias']


def test_groups_cover_the_atlas(db):
    """Every structure is in a division, bar the vessels and surface fissures that are
    not part of one. Divisions overlap on purpose, so this is coverage, not a partition."""
    G = db['groups']['data']
    S = {s['abbr'] for s in db['structures']}
    covered = set().union(*(set(g['members']) for g in G))
    assert S - covered == FREE_OF_ANY_DIVISION
    assert set(db['groups']['ungrouped']) == FREE_OF_ANY_DIVISION
    by = {g['id']: set(g['members']) for g in G}
    # the composite divisions are exactly what they claim to be
    assert by['bstem'] == by['midb'] | by['pons'] | by['medu']
    assert by['bulb'] <= by['olf']
    for lobe in ('fcx', 'pcx', 'tcx', 'ocx'):
        assert by[lobe] <= by['ctx'], lobe
    # a division is only on plates its members reach
    for g in G:
        member_plates = {p for a in g['members']
                         for p in next(s for s in db['structures'] if s['abbr'] == a)['plates']}
        assert set(g['plates']) <= member_plates, g['id']


def test_group_outlines_close(db):
    """The one geometric promise a division makes: drop every boundary its members share
    with each other and the survivors still stitch into closed rings, which is the outline
    the app draws. Rests on the tiling checked by test_shared_edges_recomputed."""
    import collections
    R = db['region_extents']['data']
    checked = rings = 0
    for g in db['groups']['data']:
        for pl in g['plates']:
            here = R.get(str(pl), {})
            parts = [here[a] for a in g['members'] if a in here]
            if not parts:
                continue
            count = collections.Counter()
            for e in parts:
                for ring in e['g']:
                    pts = ring[:-1] if ring[0] == ring[-1] else ring
                    for i in range(len(pts)):
                        a, b = tuple(pts[i]), tuple(pts[(i + 1) % len(pts)])
                        if a != b:
                            count[(a, b) if a < b else (b, a)] += 1
            keep = [e for e, n in count.items() if n % 2]
            assert keep, (g['id'], pl)
            adj = collections.defaultdict(list)
            for i, (a, b) in enumerate(keep):
                adj[a].append(i)
                adj[b].append(i)
            # every vertex of a region boundary has even degree, so every walk closes
            assert all(len(v) % 2 == 0 for v in adj.values()), (g['id'], pl)
            used = [False] * len(keep)
            for i in range(len(keep)):
                if used[i]:
                    continue
                used[i] = True
                start, cur = keep[i]
                n = 1
                while cur != start:
                    nxt = None
                    for j in adj[cur]:
                        if not used[j]:
                            used[j] = True
                            x, y = keep[j]
                            nxt = y if x == cur else x
                            break
                    assert nxt is not None, ('open ring', g['id'], pl)
                    cur, n = nxt, n + 1
                assert n >= 3, (g['id'], pl)
                rings += 1
            checked += 1
    assert checked >= 400 and rings >= checked


def test_groups_block_is_a_fresh_build(db):
    import build_groups as B
    assert db['groups'] == B.block(db)
