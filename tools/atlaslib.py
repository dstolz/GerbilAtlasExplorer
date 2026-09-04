"""What the derivation scripts share.

Paths, the database and how it is written, the plate frame in millimeters, the
page-to-plate transform, the traced outlines, and the pieces the app is built from.
Every script here used to carry its own copy of most of this, and the copies had
begun to disagree; now there is one, and the tests read it.

Nothing here imports numpy or PIL at module level, so `build_app.py` stays stdlib-only.
The geometry helpers import what they need when they are called.
"""
import argparse
import base64
import io
import json
import os
import re
import sys

# ---------- paths ----------
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
JSON = os.path.join(DATA, 'gerbil_atlas.json')
VOLUMES = os.path.join(DATA, 'gerbil_atlas_volumes.json')
VEC = os.path.join(DATA, 'vec.json')
SKULL = os.path.join(DATA, 'skull.json')
PLATES = os.path.join(DATA, 'plates')
SVGDIR = os.path.join(ROOT, 'svg')
QCDIR = os.path.join(ROOT, 'qc')
HTML = os.path.join(ROOT, 'gerbil_atlas_explorer.html')

N_PLATES = 62
KINDS = ('drawing', 'nissl', 'myelin')     # the three plates of a level, as data/plates/<kind>

# ---------- the frame the app's plate images are in ----------
NW, NH = 1100, 703                          # the frame-cropped plate image, px
# the page the label passes read, and where the app's frame sits on it (label_blocks.py)
FRAME_N = (1.0, 1.0, 2558.0, 1708.5)        # x0, y0, x1, y1 of the printed box on the page
FRAME_A = (10.25, 10.25, 1031.5, 692.25)    # the same box on the 1100 x 703 plate


def to_native(x, y):
    """A plate-frame point, on the 2558 x 1708 page the labels were read from."""
    sx = (FRAME_N[2] - FRAME_N[0]) / (FRAME_A[2] - FRAME_A[0])
    sy = (FRAME_N[3] - FRAME_N[1]) / (FRAME_A[3] - FRAME_A[1])
    return FRAME_N[0] + (x - FRAME_A[0]) * sx, FRAME_N[1] + (y - FRAME_A[1]) * sy


def from_native(x, y):
    """The inverse: a page point, in the plate frame."""
    sx = (FRAME_A[2] - FRAME_A[0]) / (FRAME_N[2] - FRAME_N[0])
    sy = (FRAME_A[3] - FRAME_A[1]) / (FRAME_N[3] - FRAME_N[1])
    return FRAME_A[0] + (x - FRAME_N[0]) * sx, FRAME_A[1] + (y - FRAME_N[1]) * sy


class Frame:
    """Plate-image fractions or pixels <-> stereotaxic millimeters, from `plate_frame`.

    Taken from the database rather than copied, so a recalibration moves everything
    together. `ml(x)` and `dv(y)` take pixels; `ml_f`/`dv_f` take fractions of the frame.
    """

    def __init__(self, pf):
        self.w, self.h = pf['width_px'], pf['height_px']
        self.ml0, self.mlpx = pf['ml_zero_px'], pf['ml_px_per_mm']
        self.dv0, self.dvpx = pf['dv_zero_px'], pf['dv_px_per_mm']

    def ml(self, x):
        return (x - self.ml0) / self.mlpx

    def dv(self, y):
        return (self.dv0 - y) / self.dvpx

    def ml_f(self, fx):
        return self.ml(fx * self.w)

    def dv_f(self, fy):
        return self.dv(fy * self.h)

    def x(self, ml):
        return self.ml0 + ml * self.mlpx

    def y(self, dv):
        return self.dv0 - dv * self.dvpx


def bregma_of(db):
    """plate number -> bregma AP, from the plate table."""
    return {p['plate']: p['bregma'] for p in db['plates']}


# ---------- the names the atlas prints that name no region ----------
#
# Not everything the atlas letters is a structure with ground of its own. A
# fissure or a sulcus is the cleft *between* two regions and is drawn as the
# line between them; `cbw` is the white matter core of whichever lobule it runs
# through rather than a lobule beside them; a vessel is not brain at all.
# Seeding those against their neighbors in build_region_extents.py hands them
# the ground either side of the line: `cbw` took 170 mm2 of cerebellum off the
# lobules it splits, and left `Crus2` a wedge of its own lobule and `PM` its
# label box. So they are not seeded, and the region whose boundary the atlas
# does draw keeps the whole of what that boundary encloses.
#
# What they lose is area, and with it an outline, a volume and a mesh. They keep
# everything the atlas actually says about them: they stay in the index, the
# search, the systems, the label tables, the projections and the label cloud,
# and hovering or selecting one marks every place the plate prints its name.
#
# `hif` is deliberately not here. The hippocampal fissure is a space the brain
# holds open and the atlas draws a boundary round, so it is a region like any
# other; and `dcw` is a territory in its own right between cortex and striatum
# rather than a name printed inside another structure.
FEATURE_KINDS = {
    'fissure':     'a cleft between regions, not a region',
    'sulcus':      'a groove between regions, not a region',
    'incisure':    'a notch in the surface, not a region',
    'white matter': 'the white matter of the lobules it runs through, '
                    'not a lobule of its own',
    'vessel':      'a vessel on the section, not part of the brain',
}

FEATURES = {
    # the cerebellar fissures and sulci, which the atlas draws as the lines
    # between the lobules
    'apmf': 'fissure', 'icf': 'fissure', 'pcn': 'fissure', 'pcuf': 'fissure',
    'plf': 'fissure', 'ppf': 'fissure', 'prf': 'fissure', 'psf': 'fissure',
    'sf': 'fissure', 'simf': 'fissure', 'uf': 'fissure',
    'pfs': 'sulcus', 'pms': 'sulcus',
    # and the three the atlas names elsewhere on the surface
    'af': 'fissure', 'rf': 'fissure', 'ri': 'incisure',
    # white matter named for what it runs through
    'cbw': 'white matter',
    # vessels
    'acer': 'vessel', 'mcer': 'vessel', 'BV': 'vessel',
}

FEATURE_NOTE = (
    "The abbreviations the atlas prints that name no region: the fissures and "
    "sulci, which are the clefts between regions and are drawn as the lines "
    "between them; `cbw`, which is the white matter core of whichever lobule it "
    "runs through and not a lobule of its own; and the vessels, which are not "
    "brain. `kinds` gives the sentence each is read by. These are named, "
    "indexed, searchable and located exactly as every other structure is, and "
    "every place a plate prints one is in `label_positions`; what they have no "
    "claim on is area, so build_region_extents.py does not seed them, they hold "
    "no entry in `region_extents`, and they have no volume or mesh. The ground "
    "they used to be given goes to the regions the atlas does draw a boundary "
    "for -- a lobule now reaches across the white matter that splits it, as the "
    "drawing has it. `hif` and `dcw` are not here: the hippocampal fissure is a "
    "space the atlas draws a boundary round, and the deep cerebral white matter "
    "is a territory of its own rather than a name printed inside another "
    "structure."
)


def features_block():
    """The `features` block of the database, from the table above."""
    return {'note': FEATURE_NOTE,
            'kinds': dict(FEATURE_KINDS),
            'data': dict(FEATURES)}


# ---------- the database ----------
def load_db(path=JSON):
    with open(path, encoding='utf8') as f:
        return json.load(f)


def dumps(o):
    """Compact JSON, the form every inlined block and every per-plate line uses."""
    return json.dumps(o, separators=(',', ':'), ensure_ascii=False)


# Blocks the pipeline writes are rendered one plate per line, compactly, so that a
# re-run diffs by plate; their summaries are one compact line. Everything else is
# indented by one space, which is how the file was first written.
_PER_PLATE = {('brain_outline', 'data'), ('label_blocks', 'data'), ('label_leaders', 'data'),
              ('region_extents', 'data'), ('region_extents', 'unassigned')}
_COMPACT = {('region_extents', 'grades'), ('region_extents', 'summary'),
            ('label_leaders', 'summary'), ('plate_registration', 'data')}


def render_db(db):
    """The database as text, byte-for-byte as the repository keeps it."""
    def enc(o, level):
        return json.dumps(o, indent=1, ensure_ascii=False).replace('\n', '\n' + ' ' * level)
    out = ['{']
    top = list(db.items())
    for i, (k, v) in enumerate(top):
        comma = ',' if i < len(top) - 1 else ''
        if isinstance(v, dict) and any((k, sub) in _PER_PLATE | _COMPACT for sub in v):
            lines = [' %s: {' % json.dumps(k)]
            items = list(v.items())
            for j, (sk, sv) in enumerate(items):
                c = ',' if j < len(items) - 1 else ''
                if (k, sk) in _PER_PLATE:
                    rows = list(sv.items())
                    body = ',\n'.join('   %s: %s' % (json.dumps(pk), dumps(pv)) for pk, pv in rows)
                    lines.append('  %s: {\n%s\n  }%s' % (json.dumps(sk), body, c))
                elif (k, sk) in _COMPACT:
                    lines.append('  %s: %s%s' % (json.dumps(sk), dumps(sv), c))
                else:
                    lines.append('  %s: %s%s' % (json.dumps(sk), enc(sv, 2), c))
            lines.append(' }' + comma)
            out.append('\n'.join(lines))
        else:
            out.append(' %s: %s%s' % (json.dumps(k), enc(v, 1), comma))
    out.append('}')
    return '\n'.join(out) + '\n'


def save_db(db, path=JSON):
    """Write the database: rendered, re-read as a check, then swapped into place."""
    text = render_db(db)
    json.loads(text)                            # never write something unreadable
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf8', newline='') as f:
        f.write(text)
    os.replace(tmp, path)


def save_json(obj, path, compact=True):
    """Any other JSON file (the volumes, the exports): compact by default."""
    text = dumps(obj) if compact else json.dumps(obj, indent=1, ensure_ascii=False) + '\n'
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf8', newline='') as f:
        f.write(text)
    os.replace(tmp, path)


# ---------- command-line conventions ----------
def parse_plates(spec, all_plates=None):
    """`30`, `28-33`, `5,30,45` or any mix of those -> sorted plate numbers.

    Every script takes the same flag, so every script reads it the same way.
    """
    if not spec:
        return list(all_plates or range(1, N_PLATES + 1))
    out = set()
    for part in str(spec).split(','):
        part = part.strip()
        if not part:
            continue
        m = re.fullmatch(r'(\d+)\s*[-–]\s*(\d+)', part)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            out.update(range(min(a, b), max(a, b) + 1))
        elif part.isdigit():
            out.add(int(part))
        else:
            raise argparse.ArgumentTypeError('cannot read a plate from %r' % part)
    bad = [p for p in out if not 1 <= p <= N_PLATES]
    if bad:
        raise argparse.ArgumentTypeError('no such plate: %s' % ', '.join(map(str, sorted(bad))))
    return sorted(out)


def add_plates_arg(ap):
    ap.add_argument('--plates', type=parse_plates, default=None,
                    help='which plates: 30, 28-33, 5,30,45, or a mix (default: all 62)')


def refuse_partial_write(args, what):
    """A run over some plates may report; it may not write.

    A block keyed by plate is written whole, so writing what a partial run read would
    drop every other plate from the committed data. Says so and returns True when the
    caller must not write.
    """
    if args.plates and len(args.plates) < N_PLATES and not getattr(args, 'dry_run', False):
        print('\n--plates writes only what it read, which would drop the other plates from '
              '%s; not writing. Re-run over all 62 to write, or add --dry-run.' % what)
        return True
    return bool(getattr(args, 'dry_run', False))


# ---------- the traced outlines and their registration ----------
def load_vec(path=VEC):
    """`data/vec.json`: per plate, `m` (page -> plate matrix) and `s` (traced paths)."""
    with open(path, encoding='utf8') as f:
        return json.load(f)


def vec_matrices(vec=None):
    """plate (str) -> the six-number affine that maps page pixels into the plate frame."""
    vec = vec or load_vec()
    return {k: v['m'] for k, v in vec.items()}


def xf(m, x, y):
    """Apply a six-number affine [a, b, c, d, e, f]."""
    return m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]


def inv6(m):
    a, b, c, d, e, f = m
    det = a * d - b * c
    return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]


def read_svg(plate):
    """The traced paths of one plate: a list of (d, stroke_width, group_id)."""
    import xml.etree.ElementTree as ET
    ns = '{http://www.w3.org/2000/svg}'
    root = ET.parse(os.path.join(SVGDIR, 'GerbilAtlas_Plate_%02d.svg' % plate)).getroot()
    out = []
    for g in root.findall(ns + 'g'):
        sw, gid = g.get('stroke-width'), g.get('id')
        for p in g.findall(ns + 'path'):
            out.append((p.get('d'), float(p.get('stroke-width') or sw or 1), gid))
    return out


_NUM = re.compile(r'-?\d*\.?\d+(?:e-?\d+)?')


def flatten(d, seg=None):
    """An SVG path `d` (M/L/C/Z, absolute) -> list of polylines, each (points, closed).

    Cubics are flattened adaptively, about one segment per three page pixels, which
    is inside the tracer's own error; pass `seg` for a fixed count instead.
    """
    import math
    toks = re.findall(r'[MLCZmlcz]|' + _NUM.pattern, d)
    polys, pts, closed = [], [], False
    cmd, i = None, 0
    cur = (0.0, 0.0)
    while i < len(toks):
        t = toks[i]
        if t in 'MLCZmlcz':
            cmd = t.upper()
            i += 1
            if cmd == 'Z':
                closed = True
                if pts:
                    polys.append((pts, True))
                pts, closed = [], False
            continue
        if cmd == 'M':
            if pts:
                polys.append((pts, False))
            cur = (float(toks[i]), float(toks[i + 1]))
            pts = [cur]
            i += 2
            cmd = 'L'
        elif cmd == 'L':
            cur = (float(toks[i]), float(toks[i + 1]))
            pts.append(cur)
            i += 2
        elif cmd == 'C':
            p0 = cur
            p1 = (float(toks[i]), float(toks[i + 1]))
            p2 = (float(toks[i + 2]), float(toks[i + 3]))
            p3 = (float(toks[i + 4]), float(toks[i + 5]))
            i += 6
            chord = math.dist(p0, p3) + math.dist(p0, p1) + math.dist(p1, p2) + math.dist(p2, p3)
            n = seg or max(2, min(32, int(chord / 3) + 2))
            for k in range(1, n + 1):
                u = k / n
                w = 1 - u
                pts.append((w ** 3 * p0[0] + 3 * w * w * u * p1[0] + 3 * w * u * u * p2[0] + u ** 3 * p3[0],
                            w ** 3 * p0[1] + 3 * w * w * u * p1[1] + 3 * w * u * u * p2[1] + u ** 3 * p3[1]))
            cur = p3
        else:
            i += 1
    if pts:
        polys.append((pts, closed))
    return polys


def rasterize(mask, x0, y0, x1, y1, value=True):
    """Draw a line into a 2-D boolean array, one pixel wide (Bresenham)."""
    h, w = mask.shape
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    x, y = x0, y0
    while True:
        if 0 <= x < w and 0 <= y < h:
            mask[y, x] = value
        if x == x1 and y == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x += sx
        if e2 <= dx:
            err += dx
            y += sy


def pip(poly, x, y):
    """Point in polygon, even-odd, the same test the app's regIn() makes."""
    c = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[j]
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            c = not c
        j = i
    return c


def poly_area(poly):
    """Shoelace area, signed."""
    s = 0.0
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        s += x0 * y1 - x1 * y0
    return s / 2


# ---------- plate images and label boxes ----------
def plate_path(kind, plate):
    return os.path.join(PLATES, kind, '%02d.jpg' % plate)


def plate_image(kind, plate):
    """One plate as a PIL image (imported here so the module stays light)."""
    from PIL import Image
    return Image.open(plate_path(kind, plate))


def label_boxes(db, plate):
    """abbr -> [[cx, cy, w, h], ...] fractions, for one plate."""
    return db['label_positions']['data'].get(str(plate), {})


# ---------- what the app is built from ----------
_ATLAS_PF = ('width_px', 'height_px', 'ml_zero_px', 'ml_px_per_mm', 'dv_zero_px', 'dv_px_per_mm')
_ATLAS_PLATE = ('plate', 'bregma', 'lambda_', 'interaural', 'occipital_crest')
_ATLAS_STRUCT = ('abbr', 'name', 'plates', 'systems', 'first_plate', 'last_plate', 'n_plates',
                 'bregma_anterior', 'bregma_posterior')


def atlas_payload(db):
    """`window.__ATLAS__`: the calibration, aliases, plate table and structure list.

    `features` and `feature_kinds` ride with the structures because that is what
    they qualify: which of the 723 names the atlas prints name no region, and the
    sentence each is read by. The app needs them wherever it would otherwise
    promise an outline, an area or a mesh."""
    f = db.get('features', {})
    return {
        'plate_frame': {k: db['plate_frame'][k] for k in _ATLAS_PF},
        'aliases': db['aliases'],
        'plates': [{k: p[k] for k in _ATLAS_PLATE} for p in db['plates']],
        'structures': [{k: s[k] for k in _ATLAS_STRUCT} for s in db['structures']],
        'groups': db.get('groups', {}).get('data', []),
        'features': f.get('data', {}),
        'feature_kinds': f.get('kinds', {}),
        'version': db.get('version', {}),
    }


def images_payload(kind, lean=False):
    """`window.__IMG__` / `__NISSL__` / `__MYELIN__`: plate -> data URI, or URL when lean."""
    out = {}
    for p in range(1, N_PLATES + 1):
        if lean:
            out[str(p)] = 'data/plates/%s/%02d.jpg' % (kind, p)
        else:
            with open(plate_path(kind, p), 'rb') as f:
                out[str(p)] = 'data:image/jpeg;base64,' + base64.b64encode(f.read()).decode('ascii')
    return out


def skull_payload():
    with open(SKULL, encoding='utf8') as f:
        return json.load(f)


def vec_payload():
    return load_vec()


def region_payload(db):
    """`window.__REGION__`: extents, unnamed faces, the grades, and the joined labels."""
    r = db['region_extents']
    return {'r': r['data'], 'u': r['unassigned'], 'k': r['grades'], 'b': db['label_blocks']['data']}


def blob_js(name, obj):
    return '<script>window.__%s__=%s;</script>' % (name, dumps(obj))
