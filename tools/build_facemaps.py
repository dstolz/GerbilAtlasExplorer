#!/usr/bin/env python3
"""The page cut into faces, published so the fixer's static page can read it.

`tools/atlasfix.py` answers **Pick** -- which face a point falls in, how big it is,
which printed labels seed it -- by cutting the plate with `build_region_extents`'s own
rasterizer. A page served by GitHub Pages has no Python to do that with, and a copy of
the cut written in JavaScript would drift from the pipeline the first time a constant
moved. So the cut is done here, once, and published: what the static page reads is the
extraction's own answer, and `--check` is what keeps the committed maps and the tracing
they were cut from in step.

Per plate, two files under `data/facemaps/`:

  plate_NN.u16.gz   the face id of every page pixel, row-major, little-endian uint16,
                    gzipped. 3296 x 2481 for a landscape plate; `page` in the JSON
                    beside it gives the shape. Raw rather than a PNG because a browser
                    hands back 8-bit channels and its own color management, and a face
                    id is a number, not a colour. DecompressionStream('gzip') reads it.
  plate_NN.json     `page`, `sizes` (pixels per face id, index 0 unused), `labels`
                    (every printed label as the extraction seeds it: abbreviation, its
                    index on the plate, and the face it lands in), and `min_face_px`.

23 to 100 KB a plate, 3.4 MB for all 62.

Reads:  data/gerbil_atlas.json, data/vec.json, svg/*.svg
Writes: data/facemaps/plate_NN.u16.gz, data/facemaps/plate_NN.json

Usage:  python3 tools/build_facemaps.py                 # all 62, about a minute
        python3 tools/build_facemaps.py --plates 19
        python3 tools/build_facemaps.py --check          # are the committed maps current
"""

import argparse
import gzip
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                              # noqa: E402
import atlasfix as F                              # noqa: E402
import build_region_extents as B                  # noqa: E402

DIR = os.path.join(A.DATA, 'facemaps')
RASTER = 'plate_%02d.u16.gz'
SIDECAR = 'plate_%02d.json'


def cut(S, plate):
    """One plate: the face raster and what goes in the JSON beside it."""
    P = S.plate(plate)
    faces, fsize, _interior = F.cut_faces(P)
    if faces.max() > 65535:
        raise SystemExit('plate %d cut into %d faces, past what a uint16 holds'
                         % (plate, faces.max()))
    seeds = F.label_seeds(P, S.DB, faces, fsize)
    meta = {'plate': plate, 'page': [P.W, P.H], 'min_face_px': B.MIN_FACE_PX,
            'mm2_per_px': round(P.mm2_per_px, 10),
            'sizes': [int(v) for v in fsize],
            'labels': [[s['abbr'], s['index'], int(s['face'])] for s in seeds]}
    return faces.astype('<u2').tobytes(), meta


def render(meta):
    """The sidecar as text: one line for the arrays, which are long and not read by eye."""
    rows = []
    for k, v in meta.items():
        rows.append(' %s: %s' % (json.dumps(k), A.dumps(v)))
    return '{\n' + ',\n'.join(rows) + '\n}\n'


def build(plates, check=False):
    S = F.Session()
    os.makedirs(DIR, exist_ok=True)
    stale, wrote = [], 0
    for p in plates:
        raw, meta = cut(S, p)
        # mtime 0 and no name, so the same cut gzips to the same bytes every run
        blob = gzip.compress(raw, 6, mtime=0)
        text = render(meta)
        rpath = os.path.join(DIR, RASTER % p)
        jpath = os.path.join(DIR, SIDECAR % p)
        if check:
            old = open(rpath, 'rb').read() if os.path.isfile(rpath) else None
            oldj = open(jpath, encoding='utf8').read() if os.path.isfile(jpath) else None
            if old != blob or oldj != text:
                stale.append(p)
                print('  plate %2d: stale' % p)
            continue
        with open(rpath + '.tmp', 'wb') as f:
            f.write(blob)
        os.replace(rpath + '.tmp', rpath)
        F.write(jpath, text)
        wrote += 1
        n = sum(1 for v in meta['sizes'][1:] if v >= B.MIN_FACE_PX)
        print('  plate %2d: %3d faces of %d px or more, %4.0f KB'
              % (p, n, B.MIN_FACE_PX, len(blob) / 1024))
    if check:
        if stale:
            raise SystemExit('\n%d face map(s) are not a fresh cut of the tracing: %s\n'
                             'Re-run python3 tools/build_facemaps.py'
                             % (len(stale), ', '.join(str(p) for p in stale)))
        print('%d face map(s) are a fresh cut of svg/ and brain_outline' % len(plates))
    else:
        total = sum(os.path.getsize(os.path.join(DIR, RASTER % p)) for p in plates)
        print('wrote %d face map(s) to %s, %.1f MB'
              % (wrote, os.path.relpath(DIR, A.ROOT), total / 1e6))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    A.add_plates_arg(ap)
    ap.add_argument('--check', action='store_true',
                    help='exit non-zero if a committed map is not a fresh cut')
    args = ap.parse_args()
    build(args.plates or list(range(1, A.N_PLATES + 1)), check=args.check)


if __name__ == '__main__':
    main()
