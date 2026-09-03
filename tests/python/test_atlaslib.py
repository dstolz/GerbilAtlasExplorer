"""The shared library: the renderer is byte-exact, the parsers agree, the payloads match."""
import json
import os

import pytest

import atlaslib as A
import build_app as B
import export_tables as E


def test_render_db_is_byte_exact():
    with open(A.JSON, encoding='utf8', newline='') as f:
        raw = f.read()
    assert A.render_db(json.loads(raw)) == raw


def test_parse_plates():
    assert A.parse_plates('30') == [30]
    assert A.parse_plates('28-33') == [28, 29, 30, 31, 32, 33]
    assert A.parse_plates('5,30,45,60-62') == [5, 30, 45, 60, 61, 62]
    assert A.parse_plates('') == list(range(1, 63))
    with pytest.raises(Exception):
        A.parse_plates('0')
    with pytest.raises(Exception):
        A.parse_plates('x')


def test_frame_round_trip():
    db = A.load_db()
    fr = A.Frame(db['plate_frame'])
    for ml in (-8, -1.33, 0, 2.5, 8):
        assert fr.ml(fr.x(ml)) == pytest.approx(ml, abs=1e-9)
    for dv in (1, 0, -4.5, -10):
        assert fr.dv(fr.y(dv)) == pytest.approx(dv, abs=1e-9)
    assert fr.ml(520.0) == 0 and fr.dv(95.81) == 0


def test_native_round_trip():
    for x, y in ((10.25, 10.25), (500, 300), (1031.5, 692.25)):
        nx, ny = A.to_native(x, y)
        bx, by = A.from_native(nx, ny)
        assert (bx, by) == pytest.approx((x, y), abs=1e-9)


def test_flatten_and_pip():
    polys = A.flatten('M 0 0 L 10 0 C 10 5 10 10 0 10 Z')
    assert len(polys) == 1 and polys[0][1] is True
    pts = polys[0][0]
    assert pts[0] == (0.0, 0.0) and pts[1] == (10.0, 0.0)
    assert A.pip([(0, 0), (10, 0), (10, 10), (0, 10)], 5, 5)
    assert not A.pip([(0, 0), (10, 0), (10, 10), (0, 10)], 15, 5)
    assert A.poly_area([(0, 0), (10, 0), (10, 10), (0, 10)]) == 100


def test_payloads():
    db = A.load_db()
    a = A.atlas_payload(db)
    assert list(a['plate_frame']) == list(A._ATLAS_PF)
    assert len(a['structures']) == 723 and list(a['structures'][0]) == list(A._ATLAS_STRUCT)
    assert a['version']['version']
    for kind in A.KINDS:
        lean = A.images_payload(kind, lean=True)
        assert lean['1'] == 'data/plates/%s/01.jpg' % kind and len(lean) == 62
    full = A.images_payload('drawing')
    assert full['30'].startswith('data:image/jpeg;base64,/9j/')
    r = A.region_payload(db)
    assert set(r) == {'r', 'u', 'k', 'b'}


def test_build_renders_every_blob():
    db = A.load_db()
    page = B.render(db)
    for name in ('ATLAS', 'IMG', 'BOX', 'LEAD', 'OUTLINE', 'SKULL', 'NISSL', 'MYELIN', 'VEC', 'REGION'):
        assert page.count('<script>window.__%s__=' % name) == 1, name
    assert '{{BUILD_HASH}}' in page and '<!-- @' not in page
    lean = B.render(db, lean=True)
    assert 'data/plates/nissl/01.jpg' in lean and 'serviceWorker' in lean
    assert 'serviceWorker' not in page


def test_unstamp_idempotent():
    db = A.load_db()
    stamped = B.render(db, commit='abc1234', date='2026-09-02')
    assert 'abc1234' in stamped and B.unstamp(stamped) == B.render(db)


def test_build_stamp_carries_the_moment():
    """The page ships the stamp as UTC text plus the instant behind it, which is what
    lets the browser show it on the reader's own clock."""
    db = A.load_db()
    page = B.render(db, commit='abc1234', date='2026-09-02', time='21:07 UTC')
    assert page.count('datetime="2026-09-02T21:07:00Z"') == 2       # the footer and About
    assert ('Updated <time class="bwhen" datetime="2026-09-02T21:07:00Z">'
            '2026-09-02 21:07 UTC</time>') in page
    assert B.unstamp(page) == B.render(db)
    # no moment to give: no instant, and the page keeps the text it was stamped with
    assert 'datetime=""' in B.render(db, commit='abc1234', date='undated', time='')


def test_committed_pages_current():
    assert B.check(A.load_db()) == 0


def test_tables_current():
    db = A.load_db()
    for name, (path, text) in E.outputs(db).items():
        with open(path, encoding='utf8', newline='') as f:
            assert f.read() == text, name


def test_labels_table_rows():
    db = A.load_db()
    text = E.labels_csv(db)
    rows = text.split('\r\n')
    assert rows[0].startswith('abbr,name,plate,label_index,ap_bregma_mm,ml_mm')
    assert len([r for r in rows[1:] if r]) == 6323
    mso = [r for r in rows if r.startswith('MSO,')]
    assert len(mso) == 7
