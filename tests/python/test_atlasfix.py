"""tools/atlasfix.py: the fixer's own answers, against the pipeline's.

The tool exists to say what a mark would do before it is sent, and its whole claim is
that it says it with the extraction's own code rather than a copy of it. So the test
that matters is the first one: the page's face map is `build_region_extents`'s face
map, pixel for pixel. The rest is the document -- a draft from the page becomes a file
`tools/corrections.py` reads, in the page frame, with millimetres that agree -- and the
handful of promises the page leans on.

The fixture is the S1DZ case of #77 on plate 19, the same one test_corrections.py uses.
"""
import json
import os
import threading
import urllib.request

import numpy as np

import atlaslib as A
import atlasfix as F
import build_region_extents as B
import corrections as C

FIX = os.path.join(os.path.dirname(__file__), 'fixtures', 'correction_p19_S1DZ.json')
PLATE = 19
SEED = (1079.0, 955.0)          # page px inside the left S1DZ strip


def session():
    if not hasattr(session, 'S'):
        session.S = F.Session()
    return session.S


def fixture_draft():
    with open(FIX, encoding='utf8') as f:
        return F.draft_of(json.load(f))


# ------------------------------------------------------------------- the cut

def test_the_face_map_is_the_pipelines_own():
    """With nothing added, the page cuts the plate into exactly the faces
    build_plate cuts it into -- same ink, same bridges, same labels. This is what
    lets `Pick` answer instantly and still be right; MATLAB's copy of these four
    steps is the thing this tool exists not to have."""
    S = session()
    P = S.plate(PLATE)
    mine, fsize, interior = F.cut_faces(P)
    r = B.build_plate(PLATE, S.DB, S.VECM, want_qc=True)
    theirs = r[3][8]
    assert mine.shape == theirs.shape
    assert np.array_equal(mine, theirs)
    assert interior[int(SEED[1]), int(SEED[0])]
    assert fsize[mine[int(SEED[1]), int(SEED[0])]] >= B.MIN_FACE_PX


def test_a_drawn_boundary_is_ink_in_the_cut():
    """A boundary in the draft walls the page off where it is drawn, before it is
    anywhere near the SVG: that is what makes the preview worth reading. A ring
    inside the largest face has to make a face of its own out of what it encloses.

    (The fixture's own boundary adds nothing here, because the committed tracing
    carries that run already -- #77 fixed it. See test_corrections.py.)"""
    from scipy import ndimage
    S = session()
    P = S.plate(PLATE)
    plain, fsize, _in = F.cut_faces(P)
    big = int(np.argmax(fsize[1:])) + 1
    deep = ndimage.distance_transform_edt(plain == big)
    y, x = np.unravel_index(int(np.argmax(deep)), deep.shape)
    r = 30
    ring = [(x - r, y - r), (x + r, y - r), (x + r, y + r), (x - r, y + r), (x - r, y - r)]
    with_it, _sz, _in2 = F.cut_faces(P, [(ring, True)])
    assert with_it.max() == plain.max() + 1          # one more face than before
    assert with_it[y, x] != with_it[y - r - 5, x]    # its inside is not its outside
    assert plain[y, x] == plain[y - r - 5, x] == big  # and the two were one face


def test_probe_names_the_face_and_who_holds_the_point():
    S = session()
    r = S.probe(PLATE, SEED)
    assert r['mm'] == [-4.13, -2.877]           # the frames, as the fixture has them
    assert r['face'] and r['face_px'] >= B.MIN_FACE_PX
    assert r['names'] == ['S1DZ'] and r['owner'] == 'S1DZ'
    assert r['ink_px'] > 0


def test_the_payload_is_the_plate_in_the_page_frame():
    S = session()
    p = S.payload(PLATE)
    assert p['page'] == [3296, 2481] and p['plate'] == PLATE
    assert p['bregma'] == A.bregma_of(S.DB)[PLATE]
    assert {q['style'] for q in p['paths']} <= {'solid', 'dashed'}
    assert len(p['paths']) == len(B.read_svg(S.plate(PLATE).svg)[2])
    ab = {r['abbr'] for r in p['regions']}
    assert 'S1DZ' in ab and ab == set(S.DB['region_extents']['data'][str(PLATE)])
    assert p['layers'] == ['drawing', 'mri', 'myelin', 'nissl']
    # every ring reaches the page from a fraction and comes back to the same fraction
    P = S.plate(PLATE)
    ring = next(r for r in p['regions'] if r['abbr'] == 'S1DZ')['rings'][0]
    src = S.DB['region_extents']['data'][str(PLATE)]['S1DZ']['g'][0]
    for (x, y), (fx, fy) in zip(ring, src):
        gx, gy = P.page_to_frac(x, y)
        assert abs(gx - fx) < 2e-4 and abs(gy - fy) < 2e-4


# ------------------------------------------------------------- the document

def test_a_draft_becomes_a_file_corrections_reads():
    S = session()
    doc = F.document(fixture_draft(), S)
    assert doc['schema'] == C.SCHEMA
    assert doc['id'].endswith('-p19-S1DZ')
    C.validate(doc, S.DB, S.VECM)               # names, geometry, and page px against mm
    text = F.render(doc)
    back = json.loads(text)
    assert back['seeds'][0]['page_px'] == [1079, 955]
    assert back['boundaries'][0]['style'] == 'dashed'
    assert '"page_px": [[1162,1043],[1186,1061]]' in text     # a point list is one line


def test_the_two_frames_are_written_from_one_transform():
    """page_px is what is read and mm is for the reader, and check_frames refuses a
    file where they disagree: the page only ever sends page px, so this is the test
    of the conversion the document makes."""
    S = session()
    P = S.plate(PLATE)
    draft = {'plate': PLATE, 'abbr': 'S1DZ', 'problem': 'x',
             'seeds': [{'abbr': 'S1DZ', 'page_px': list(SEED)}],
             'boundaries': [{'style': 'solid', 'page_px': [[1162, 1043], [1186, 1061]]}]}
    doc = F.document(draft, S)
    C.check_frames(doc, P)
    ml, dv = P.page_to_mm(*SEED)
    assert doc['seeds'][0]['mm'] == [round(ml, 3), round(dv, 3)]
    assert doc['hemisphere'] == 'left'          # read off the marks, both being ML < 0


def test_hemisphere_is_read_off_the_marks():
    assert F.hemisphere_of({'seeds': [{'mm': [-1, 0]}, {'mm': [-3, 0]}]}) == 'left'
    assert F.hemisphere_of({'seeds': [{'mm': [1, 0]}]}) == 'right'
    assert F.hemisphere_of({'seeds': [{'mm': [-1, 0]}, {'mm': [1, 0]}]}) == 'both'
    assert F.hemisphere_of({'boundaries': [{'mm': [[-2, 0], [-1, 0]]}]}) == 'left'
    assert F.hemisphere_of({}) == ''


def test_commit_refuses_a_draft_with_nothing_in_it():
    S = session()
    for draft, why in (({'plate': PLATE, 'abbr': '', 'problem': 'x'}, 'region'),
                       ({'plate': PLATE, 'abbr': 'S1DZ', 'problem': ''}, 'wrong'),
                       ({'plate': PLATE, 'abbr': 'S1DZ', 'problem': 'x'}, 'Mark')):
        try:
            F.commit(S, draft, dry=True)
            raise AssertionError('committed %r' % draft)
        except F.Failed as e:
            assert why.lower() in str(e).lower()


def test_a_dry_run_writes_a_file_that_validates(tmp_path, monkeypatch):
    S = session()
    monkeypatch.setattr(A, 'ROOT', str(tmp_path))
    r = F.commit(S, fixture_draft(), dry=True)
    path = os.path.join(str(tmp_path), r['path'])
    assert os.path.isfile(path)
    c = C.load(path)
    C.validate(c, S.DB, S.VECM)
    assert c['abbr'] == 'S1DZ' and len(c['seeds']) == 1


# ------------------------------------------------------------------- the recut

def test_recut_builds_the_plate_the_correction_would_leave(tmp_path):
    """The seed and the missed run give S1DZ back the strip, as #77 did. The tree
    the tool is reading from is not touched: apply runs against a copy."""
    S = session()
    svg = os.path.join(A.SVGDIR, 'GerbilAtlas_Plate_%02d.svg' % PLATE)
    before_svg = open(svg, encoding='utf8').read()
    before_db = open(A.JSON, encoding='utf8').read()
    r = F.recut(S, fixture_draft())
    assert open(svg, encoding='utf8').read() == before_svg
    assert open(A.JSON, encoding='utf8').read() == before_db
    assert A.SVGDIR.endswith('svg') and callable(A.save_db)      # put back afterwards
    got = {row['abbr']: row for row in r['regions']}
    assert got['S1DZ']['after'] > 0
    assert 'S1DZ' in r['changed']
    assert any('seed_overrides 19/S1DZ' in ln for ln in r['lines'])
    assert not any(ln.startswith('  wrote ') for ln in r['lines'])


# --------------------------------------------------------------- over the wire

class Served:
    def __enter__(self):
        self.srv = F.serve(session(), '127.0.0.1', 0, {'tool': F.TOOL, 'start': {}})
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.url = 'http://127.0.0.1:%d' % self.srv.server_address[1]
        return self

    def __exit__(self, *a):
        self.srv.shutdown()
        self.srv.server_close()

    def get(self, path):
        with urllib.request.urlopen(self.url + path) as r:
            return r.status, r.read()

    def post(self, path, obj):
        req = urllib.request.Request(self.url + path, method='POST',
                                     data=json.dumps(obj).encode(),
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())


def test_the_server_answers_for_the_page():
    with Served() as s:
        code, body = s.get('/')
        assert code == 200 and b'<canvas id="cv">' in body
        assert s.get('/fixer.js')[0] == 200 and s.get('/fixer.css')[0] == 200
        code, body = s.get('/api/plate/%d' % PLATE)
        assert code == 200 and json.loads(body)['plate'] == PLATE
        assert s.get('/api/image/drawing/%d.jpg' % PLATE)[1][:2] == b'\xff\xd8'
        code, body = s.post('/api/probe', {'plate': PLATE, 'at': list(SEED)})
        assert code == 200 and body['owner'] == 'S1DZ'


def test_the_server_says_no_rather_than_falling_over():
    with Served() as s:
        for path in ('/api/plate/99', '/api/plate/0'):
            try:
                s.get(path)
                raise AssertionError('served %s' % path)
            except urllib.error.HTTPError as e:
                assert e.code == 400 and b'no plate' in e.read()
        for path in ('/../tools/atlaslib.py', '/api/image/drawing/../../x.jpg', '/nope'):
            try:
                assert s.get(path)[0] == 404
            except urllib.error.HTTPError as e:
                assert e.code == 404
        code, body = s.post('/api/document', {'draft': {'plate': PLATE, 'abbr': 'nosuch'}})
        assert code == 400 and 'nosuch' in body['error']
