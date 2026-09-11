"""The shared library: the renderer is byte-exact, the parsers agree, the payloads match."""
import json
import re

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
    assert len(a['structures']) == 724 and list(a['structures'][0]) == list(A._ATLAS_STRUCT)
    assert a['version']['version']
    for kind in A.KINDS:
        lean = A.images_payload(kind, lean=True)
        assert lean['1'] == 'data/plates/%s/01.jpg' % kind and len(lean) == 62
    full = A.images_payload('drawing')
    assert full['30'].startswith('data:image/jpeg;base64,/9j/')
    r = A.region_payload(db)
    assert set(r) == {'r', 'u', 'k', 'b', 'c', 'm'}
    assert r['c'] == db['region_colors']['data'] and r['m'] == db['region_colors']['merged']


def test_build_renders_every_blob():
    db = A.load_db()
    page = B.render(db)
    for name in ('ATLAS', 'IMG', 'BOX', 'LEAD', 'OUTLINE', 'SKULL', 'NISSL', 'MYELIN', 'VEC', 'REGION'):
        assert page.count('<script>window.__%s__=' % name) == 1, name
    assert '{{BUILD_HASH}}' in page and '<!-- @' not in page
    lean = B.render(db, lean=True)
    assert 'data/plates/nissl/01.jpg' in lean and 'serviceWorker' in lean
    assert 'serviceWorker' not in page
    # the worker is registered under the build, so each build gets a cache of its own
    assert 'register("sw.js?v={{BUILD_HASH}}")' in lean
    stamped = B.render(db, lean=True, commit='abc1234')
    assert 'register("sw.js?v=abc1234")' in stamped and B.unstamp(stamped) == lean


def test_the_build_claim_is_one_removable_span():
    """The footer and About each name the build inside one span, and that is what src/app.js
    removes when the stamp is a token and not a commit. It has to: the committed pages keep
    their tokens, and Pages serves main's root until its source is the workflow that stamps
    the copy it deploys, so an unstamped page does reach readers. Every token but the meta's
    and the worker's cache key is inside one of the two spans, which is to say every one a
    reader would otherwise read."""
    db = A.load_db()
    page = B.render(db)
    assert page.count('<span class="fbuild">') == 2 and page.count('/commit/{{BUILD_HASH}}') == 2
    # the meta, and twice a link and the code that shows it; a date in the meta and each
    # stamp; the time only in the footer's; an instant behind both stamps
    assert page.count('{{BUILD_HASH}}') == 5 and page.count('{{BUILD_DATE}}') == 3
    assert page.count('{{BUILD_TIME}}') == 1 and page.count('{{BUILD_ISO}}') == 2
    # the lean page adds one the reader never sees: the worker is registered under the build
    assert B.render(db, lean=True).count('{{BUILD_HASH}}') == 6


def test_an_unstamped_page_dates_the_data_instead():
    """A page nothing stamped drops the build claim, and says instead when the data it carries
    was last recomputed -- the one date every copy knows, stamped or not. One span apiece in the
    footer and in About, hidden until src/app.js fills the date in from the database, and no
    build token inside either: the claim they stand in for is the one that cannot be made."""
    db = A.load_db()
    page = B.render(db)
    assert page.count('<span class="fdata" hidden') == 2
    assert page.count('<time class="dwhen"></time>') == 2
    # the date is the database's own, and it rides to the page in __ATLAS__ either way
    assert re.fullmatch(r'\d{4}-\d\d-\d\d', db['version']['generated'])
    assert A.atlas_payload(db)['version']['generated'] == db['version']['generated']
    assert B.render(db, lean=True).count('<time class="dwhen"></time>') == 2


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


# Whether the committed pages, tables and geojson are a fresh build is not asserted here:
# `tools/build_app.py --check` and `tools/export_tables.py --check` are that check, they run
# in CI beside this file, and the second of them also verifies the derived fields in the JSON,
# which no test here ever did. See .github/workflows/ci.yml.


def test_labels_table_rows():
    db = A.load_db()
    text = E.labels_csv(db)
    rows = text.split('\r\n')
    assert rows[0].startswith('abbr,name,plate,label_index,ap_bregma_mm,ml_mm')
    assert len([r for r in rows[1:] if r]) == 6351
    mso = [r for r in rows if r.startswith('MSO,')]
    assert len(mso) == 7


def test_methods_numbers_come_from_the_database():
    """The totals METHODS.md states between <!-- n:... --> markers are the database's,
    formatted as the prose formats them, and export_tables rewrites them."""
    import export_tables as E
    db = A.load_db()
    txt = E.methods_text(db)
    with open(E.METHODS, encoding='utf8', newline='') as f:
        assert f.read() == txt                         # the committed file is current
    keys = [m.group(2) for m in E.MARK.finditer(txt)]
    assert 'region_extents.summary.points' in keys and 'region_colors.summary.patches' in keys
    for k in keys:
        assert E.number_at(db, k) is not None
    assert E.format_number(168740) == '168,740' and E.format_number(0.9484) == '0.9484'
    assert E.format_number(True) == 'yes'
    db2 = json.loads(json.dumps(db))
    db2['region_extents']['summary']['points'] += 11
    assert '168,751' in E.methods_text(db2) or format(db2['region_extents']['summary']['points'], ',') in E.methods_text(db2)


def test_save_json_rows_is_one_line_per_entry(tmp_path):
    p = str(tmp_path / 'v.json')
    A.save_json_rows({'note': 'n', 'data': {'a': [1, 2], 'b': {'x': 1}}}, p)
    with open(p, encoding='utf8') as f:
        txt = f.read()
    assert txt == '{\n"note":"n",\n"data":{\n"a":[1,2],\n"b":{"x":1}\n}\n}\n'
    assert json.loads(txt) == {'note': 'n', 'data': {'a': [1, 2], 'b': {'x': 1}}}
