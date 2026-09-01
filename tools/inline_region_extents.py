#!/usr/bin/env python3
"""Splice `window.__REGION__` into the single-file app.

The app carries its own copy of every data block so that it stays one file you
can open, and `data/gerbil_atlas.json` stays the readable source. This keeps
the two in step for the region extents.

Read line by line rather than with a regex over the whole file: the HTML is
20 MB and one of its lines is a 6 MB base64 blob.

Usage:  python3 tools/inline_region_extents.py [--check]
"""

import argparse
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON = os.path.join(ROOT, 'data', 'gerbil_atlas.json')
HTML = os.path.join(ROOT, 'gerbil_atlas_explorer.html')

TAG = '<script>window.__REGION__='
AFTER = '<script>window.__VEC__='


def payload():
    R = json.load(open(JSON))['region_extents']
    return TAG + json.dumps(
        {'r': R['data'], 'u': R['unassigned'], 'k': R['grades']},
        separators=(',', ':')) + '</script>\n'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true',
                    help='report whether the inlined copy is current')
    a = ap.parse_args()

    want = payload()
    out, seen, vec = [], False, -1
    with open(HTML) as f:
        for i, line in enumerate(f):
            if line.startswith(TAG):
                seen = True
                if a.check:
                    print('__REGION__ line %d: %s'
                          % (i + 1, 'current' if line == want else 'STALE'))
                    return
                out.append(want)
                continue
            if line.startswith(AFTER):
                vec = len(out)
            out.append(line)
    if a.check:
        print('__REGION__ absent from the app')
        return
    if not seen:
        if vec < 0:
            raise SystemExit('%s not found in %s' % (AFTER, HTML))
        out.insert(vec + 1, want)
    tmp = HTML + '.tmp'
    with open(tmp, 'w') as f:
        f.writelines(out)
    os.replace(tmp, HTML)
    print('%s %s (%.1f MB, +%.2f MB)'
          % ('replaced' if seen else 'inserted', TAG.strip('<script>window.='),
             os.path.getsize(HTML) / 1e6, len(want) / 1e6))


if __name__ == '__main__':
    main()
