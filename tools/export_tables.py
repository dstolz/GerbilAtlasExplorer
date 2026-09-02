#!/usr/bin/env python3
"""The flat files: CSV tables and GeoJSON, all derived from data/gerbil_atlas.json.

The database is one JSON file two-thirds of which is polygon geometry, and the things
most readers want -- a coordinate per label, a row per structure -- are a few percent
of it and were not available flat at all. This writes them, and rewrites the two CSVs
that used to be kept by hand (and had drifted from the JSON), so that they cannot drift
again: CI runs `--check` and fails if a committed table is not what the JSON says.

    data/gerbil_atlas_structures.csv     one row per structure, as before
    data/gerbil_atlas_plates.csv         one row per plate, as before
    data/gerbil_atlas_labels.csv         one row per printed label: 6,266 stereotaxic triplets
    data/gerbil_atlas_structure_table.csv  one row per structure with its label centre,
                                         areas, and the volume and centre from the meshes
    data/gerbil_atlas_groups.csv         one row per gross division, with its members
    data/geojson/plate_NN.geojson        the region extents of one plate, in millimetres

`--refresh-db` also recomputes the per-plate counts the database carries
(`n_structures`, `n_labels_located`, `ocr_confirmed`) and the `plate_registration`
block from data/vec.json, and stamps `version.generated`. `--check` verifies all of it.
"""
import argparse
import csv
import datetime
import io
import math
import json
import os
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A  # noqa: E402

GEO = os.path.join(A.DATA, 'geojson')
FILES = {
    'structures': os.path.join(A.DATA, 'gerbil_atlas_structures.csv'),
    'plates': os.path.join(A.DATA, 'gerbil_atlas_plates.csv'),
    'labels': os.path.join(A.DATA, 'gerbil_atlas_labels.csv'),
    'table': os.path.join(A.DATA, 'gerbil_atlas_structure_table.csv'),
    'groups': os.path.join(A.DATA, 'gerbil_atlas_groups.csv'),
}
VERSION = '0.9.0'
SCHEMA = '1.0'


def csv_text(rows, header):
    """CSV as the repository keeps it: CRLF, minimal quoting, no BOM."""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\r\n')
    w.writerow(header)
    for r in rows:
        w.writerow(r)
    return buf.getvalue()


def fmt(x, nd=2):
    """A number for a CSV cell: trimmed, never `-0`."""
    if x is None or x == '':
        return ''
    if isinstance(x, int):
        return str(x)
    s = ('%.*f' % (nd, x)).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


# ---------- what a label means, and where ----------
def positions(db):
    """Every printed label with its stereotaxic triplet, in plate then abbr order.

    The position is the end of the label's leader line where the atlas draws one and
    the centre of the printed word otherwise -- the same rule the app applies.
    """
    fr = A.Frame(db['plate_frame'])
    breg = A.bregma_of(db)
    names = {s['abbr']: s['name'] for s in db['structures']}
    leads = db['label_leaders']['data']
    out = []
    for p in range(1, A.N_PLATES + 1):
        boxes = db['label_positions']['data'].get(str(p), {})
        tips = leads.get(str(p), {})
        for ab in sorted(boxes):
            tip_of = {t[0]: (t[1], t[2]) for t in tips.get(ab, [])}
            for i, (cx, cy, w, h) in enumerate(boxes[ab]):
                tip = tip_of.get(i)
                x, y = tip if tip else (cx, cy)
                out.append({
                    'abbr': ab, 'name': names.get(ab, ''), 'plate': p, 'index': i,
                    'ap': breg[p], 'ml': fr.ml_f(x), 'dv': fr.dv_f(y),
                    'from': 'leader tip' if tip else 'label box',
                    'cx': cx, 'cy': cy, 'w': w, 'h': h,
                    'tx': tip[0] if tip else '', 'ty': tip[1] if tip else '',
                })
    return out


def labels_csv(db):
    header = ['abbr', 'name', 'plate', 'label_index', 'ap_bregma_mm', 'ml_mm', 'ml_abs_mm',
              'dv_mm', 'position_from', 'box_cx_frac', 'box_cy_frac', 'box_w_frac', 'box_h_frac',
              'leader_tip_x_frac', 'leader_tip_y_frac']
    rows = []
    for q in positions(db):
        rows.append([q['abbr'], q['name'], q['plate'], q['index'], fmt(q['ap']), fmt(q['ml']),
                     fmt(abs(q['ml'])), fmt(q['dv']), q['from'], fmt(q['cx'], 4), fmt(q['cy'], 4),
                     fmt(q['w'], 4), fmt(q['h'], 4), fmt(q['tx'], 4), fmt(q['ty'], 4)])
    return csv_text(rows, header)


def structures_csv(db):
    header = ['abbreviation', 'structure', 'first_plate', 'last_plate', 'n_plates',
              'bregma_anterior_mm', 'bregma_posterior_mm', 'systems', 'plates']
    rows = []
    for s in db['structures']:
        rows.append([s['abbr'], s['name'], s['first_plate'], s['last_plate'], s['n_plates'],
                     str(float(s['bregma_anterior'])), str(float(s['bregma_posterior'])),
                     ';'.join(s['systems']), ' '.join(map(str, s['plates']))])
    return csv_text(rows, header)


def groups_csv(db):
    """The gross divisions, one row each, with every member spelled out.

    Flat and readable so the taxonomy can be argued with without opening the JSON or the
    Python: it is the one block of this database that is a judgement rather than a
    transcription of what the atlas prints.
    """
    header = ['id', 'label', 'division', 'n_structures', 'first_plate', 'last_plate',
              'n_plates', 'bregma_anterior_mm', 'bregma_posterior_mm', 'aliases',
              'structures', 'plates', 'note']
    rows = []
    for g in db.get('groups', {}).get('data', []):
        rows.append([g['id'], g['abbr'], g['name'], g['n_members'], g['first_plate'],
                     g['last_plate'], g['n_plates'], str(float(g['bregma_anterior'])),
                     str(float(g['bregma_posterior'])), ';'.join(g.get('alias', [])),
                     ' '.join(g['members']), ' '.join(map(str, g['plates'])), g['note']])
    return csv_text(rows, header)


def plates_csv(db):
    header = ['plate', 'bregma_mm', 'lambda_mm', 'interaural_mm', 'occipital_crest_mm', 'n_structures']
    rows = [[p['plate'], str(float(p['bregma'])), str(float(p['lambda_'])), str(float(p['interaural'])),
             str(float(p['occipital_crest'])), p['n_structures']] for p in db['plates']]
    return csv_text(rows, header)


def load_volumes():
    if not os.path.exists(A.VOLUMES):
        return {}
    with open(A.VOLUMES, encoding='utf8') as f:
        return json.load(f).get('data', {})


def table_csv(db, vols=None):
    """One row per structure: the label centre the app's card shows, the areas the
    extents give it, and the volume and centre the meshes give it."""
    vols = load_volumes() if vols is None else vols
    # sums are math.fsum: exact, so the table is the same on every Python (3.12 changed
    # what sum() does with floats, and a last-digit difference is a stale table in CI)
    header = ['abbr', 'name', 'systems', 'first_plate', 'last_plate', 'n_plates', 'plates',
              'n_labels', 'n_plates_labelled', 'label_ap_bregma_median_mm', 'label_ml_abs_median_mm',
              'label_dv_median_mm', 'n_plates_with_extent', 'area_mm2_sum', 'area_mm2_max',
              'traced_fraction_min', 'volume_mm3', 'mesh_grade', 'n_components',
              'centre_ml_mm', 'centre_dv_mm', 'centre_ap_mm']
    by = {}
    for q in positions(db):
        by.setdefault(q['abbr'], []).append(q)
    ext = db['region_extents']['data']
    rows = []
    for s in db['structures']:
        ab = s['abbr']
        q = by.get(ab, [])
        areas, smin, nx = [], None, 0
        for p in s['plates']:
            e = ext.get(str(p), {}).get(ab)
            if e:
                nx += 1
                areas.append(e['a'])
                m = min(e['s'])
                smin = m if smin is None else min(smin, m)
        v = vols.get(ab, {})
        comps = v.get('components', [])
        big = max(comps, key=lambda c: c['volume_mm3']) if comps else None
        med = lambda k: fmt(statistics.median(x[k] for x in q)) if q else ''  # noqa: E731
        rows.append([ab, s['name'], ';'.join(s['systems']), s['first_plate'], s['last_plate'],
                     s['n_plates'], ' '.join(map(str, s['plates'])), len(q),
                     len({x['plate'] for x in q}), med('ap'),
                     fmt(statistics.median(abs(x['ml']) for x in q)) if q else '', med('dv'),
                     nx, fmt(math.fsum(areas), 3) if areas else '', fmt(max(areas), 3) if areas else '',
                     fmt(smin, 2) if smin is not None else '',
                     fmt(v.get('volume_mm3'), 4) if v else '', v.get('grade', ''),
                     len(comps) if v else '',
                     fmt(big['centre_mm'][0]) if big else '', fmt(big['centre_mm'][1]) if big else '',
                     fmt(big['centre_mm'][2]) if big else ''])
    return csv_text(rows, header)


# ---------- GeoJSON ----------
def geojson(db, plate):
    """The extents of one plate as a FeatureCollection in millimetres (x = ML, y = DV)."""
    fr = A.Frame(db['plate_frame'])
    breg = A.bregma_of(db)
    names = {s['abbr']: s['name'] for s in db['structures']}
    mm = lambda pt: [round(fr.ml_f(pt[0]), 3), round(fr.dv_f(pt[1]), 3)]  # noqa: E731
    ring = lambda g: [mm(pt) for pt in g] + [mm(g[0])]  # noqa: E731
    feats = []
    for ab, e in db['region_extents']['data'].get(str(plate), {}).items():
        feats.append({'type': 'Feature',
                      'geometry': {'type': 'MultiPolygon', 'coordinates': [[ring(g)] for g in e['g']]},
                      'properties': {'abbr': ab, 'name': names.get(ab, ''), 'plate': plate,
                                     'ap_bregma_mm': breg[plate], 'area_mm2': e['a'],
                                     'traced_fraction': e['s'], 'n_labels': e['n'],
                                     'no_drawn_outline': bool(e.get('w'))}})
    for k, g in enumerate(db['region_extents']['unassigned'].get(str(plate), [])):
        feats.append({'type': 'Feature',
                      'geometry': {'type': 'Polygon', 'coordinates': [ring(g)]},
                      'properties': {'abbr': None, 'name': 'unnamed sealed face', 'plate': plate,
                                     'ap_bregma_mm': breg[plate], 'index': k}})
    outline = db['brain_outline']['data'].get(str(plate), [])
    if outline:
        feats.append({'type': 'Feature',
                      'geometry': {'type': 'MultiPolygon', 'coordinates': [[ring(g)] for g in outline]},
                      'properties': {'abbr': 'brain_outline', 'name': 'outline of the section',
                                     'plate': plate, 'ap_bregma_mm': breg[plate]}})
    return {'type': 'FeatureCollection',
            'name': 'GerbilAtlas plate %02d' % plate,
            'note': 'Region extents cut from the atlas drawing (METHODS.md, Region extents). '
                    'Coordinates are [ML, DV] in mm, ML positive to the right of the plate as printed, '
                    'DV negative below the dorsal surface; AP is the plate bregma. traced_fraction is '
                    'the share of each polygon boundary the atlas actually draws; below 0.5 the '
                    'boundary is an estimate. no_drawn_outline marks a feature that lies only inside '
                    'boundaries the atlas draws round more than one name and prints nothing within, '
                    'so the whole of its outline is where the extraction cut it. Not a segmentation.',
            'plate': plate, 'ap_bregma_mm': breg[plate], 'features': feats}


def geojson_text(db, plate):
    return A.dumps(geojson(db, plate)) + '\n'


# ---------- what the database derives from itself ----------
def refresh_db(db, today=None):
    """Recompute the per-plate counts, the registration block and the version stamp.
    Returns True if anything changed."""
    before = A.render_db(db)
    count = {}
    for s in db['structures']:
        for p in s['plates']:
            count[p] = count.get(p, 0) + 1
    for p in db['plates']:
        n = p['plate']
        boxes = db['label_positions']['data'].get(str(n), {})
        p['n_structures'] = count.get(n, 0)
        p['ocr_confirmed'] = sorted(boxes)
        p['n_labels_located'] = sum(len(v) for v in boxes.values())
    vec = A.load_vec()
    db['plate_registration'] = {
        'note': 'The affine [a, b, c, d, e, f] that maps the traced page (3296 x 2481 px; 2481 x 3296 '
                'for plate 20) into the 1100 x 703 plate frame: x\' = a x + c y + e, y\' = b x + d y + f. '
                'Fitted per plate against the plate\'s own printed ink (METHODS.md, Vectorized outlines). '
                'The same matrices sit beside the traced paths in data/vec.json.',
        'data': {k: vec[k]['m'] for k in sorted(vec, key=int)},
    }
    v = db.setdefault('version', {})
    v['schema'] = SCHEMA
    v['version'] = VERSION
    v.setdefault('generated', today or datetime.date.today().isoformat())
    v['note'] = ('version is the release of this repository the data belongs to; generated is the '
                 'day the derived fields were last recomputed by tools/export_tables.py.')
    changed = A.render_db(db) != before
    if changed:
        v['generated'] = today or datetime.date.today().isoformat()
    return changed


def outputs(db):
    """name -> (path, text) for everything this script writes."""
    out = {
        'structures': (FILES['structures'], structures_csv(db)),
        'plates': (FILES['plates'], plates_csv(db)),
        'labels': (FILES['labels'], labels_csv(db)),
        'table': (FILES['table'], table_csv(db)),
        'groups': (FILES['groups'], groups_csv(db)),
    }
    for p in range(1, A.N_PLATES + 1):
        out['geojson %02d' % p] = (os.path.join(GEO, 'plate_%02d.geojson' % p), geojson_text(db, p))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--check', action='store_true', help='exit 1 if any committed table is stale')
    ap.add_argument('--refresh-db', action='store_true',
                    help='also recompute the per-plate counts and version stamp in the JSON')
    ap.add_argument('--today', help='the date to stamp (default: today), for reproducible runs')
    a = ap.parse_args()
    db = A.load_db()
    if a.check:
        stale = []
        db2 = json.loads(json.dumps(db))
        db2.get('version', {}).pop('generated', None)
        refresh_db(db2, today='')
        db3 = json.loads(json.dumps(db))
        db3.get('version', {}).pop('generated', None)
        db3.get('version', {}).pop('note', None)
        db2.get('version', {}).pop('generated', None)
        db2.get('version', {}).pop('note', None)
        if A.render_db(db2) != A.render_db(db3):
            stale.append('derived fields in data/gerbil_atlas.json (run --refresh-db)')
        for name, (path, text) in outputs(db).items():
            try:
                with open(path, encoding='utf8', newline='') as f:
                    have = f.read()
            except FileNotFoundError:
                have = None
            if have != text:
                stale.append(os.path.relpath(path, A.ROOT))
        if stale:
            print('STALE: ' + ', '.join(stale[:8]) + (' ...' if len(stale) > 8 else ''))
            print('run: python3 tools/export_tables.py --refresh-db')
            return 1
        print('tables current')
        return 0
    if a.refresh_db:
        if refresh_db(db, a.today):
            A.save_db(db)
            print('database derived fields refreshed')
        else:
            print('database derived fields already current')
    os.makedirs(GEO, exist_ok=True)
    for name, (path, text) in outputs(db).items():
        with open(path + '.tmp', 'w', encoding='utf8', newline='') as f:
            f.write(text)
        os.replace(path + '.tmp', path)
    print('wrote %d files under data/' % len(outputs(db)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
