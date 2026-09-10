#!/usr/bin/env python3
"""The derivation pipeline as two commands: `rebuild` runs the build steps in the order
each reads what the one before wrote, and `check` runs every check the repository has.

    python3 tools/pipeline.py rebuild                 # the six steps, ~10 min
    python3 tools/pipeline.py rebuild --plates 28     # a preview: cut one plate, --dry-run --qc
    python3 tools/pipeline.py rebuild --from colors   # resume at a step
    python3 tools/pipeline.py check                   # every --check, then the tests
    python3 tools/pipeline.py check --no-tests        # the --check runs alone
    python3 tools/pipeline.py steps                   # print the steps and stop

The order and the completeness are what this holds. A correction rebuilds everything
cut from the extents, and a step left out -- the face maps, most often -- is what a
`--check` catches an hour later in CI. Each step is its own script and runs as its own
process, so a failure names the script and its output is the script's own.
"""
import argparse
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A  # noqa: E402

PY = sys.executable

# name, argv (relative to tools/), what it writes
REBUILD = [
    ('outline', ['build_brain_outline.py'], 'brain_outline'),
    ('extents', ['build_region_extents.py'], 'region_extents, features'),
    ('volumes', ['build_volumes.py', '--nifti', 'data/gerbil_atlas_labels.nii.gz'],
     'gerbil_atlas_volumes.json, the NIfTI label volume and its LUT'),
    ('colors', ['build_region_colors.py'], 'region_colors'),
    ('facemaps', ['build_facemaps.py'], 'data/facemaps/'),
    ('tables', ['export_tables.py', '--refresh-db'],
     'the CSVs, the GeoJSON, the derived fields in the JSON, the METHODS.md numbers'),
    ('pages', ['build_app.py', '--lean'],
     'gerbil_atlas_explorer.html, index.html, fixer.html'),
]

CHECK = [
    ('indexes', ['check_indexes.py']),
    ('tables', ['export_tables.py', '--check']),
    ('groups', ['build_groups.py', '--check']),
    ('colors', ['build_region_colors.py', '--check']),
    ('facemaps', ['build_facemaps.py', '--check']),
    ('pages', ['build_app.py', '--check']),
]
TESTS = ('tests', [PY, '-m', 'pytest', 'tests/python', '-q'])


def run(name, argv, quiet=False):
    """One step, as a subprocess from the repository root. Returns its exit code."""
    cmd = argv if argv[0] == PY else [PY, os.path.join('tools', argv[0])] + argv[1:]
    print('== %s: %s' % (name, ' '.join('python3' if c == PY else c for c in cmd)), flush=True)
    t0 = time.time()
    r = subprocess.run(cmd, cwd=A.ROOT, stdout=subprocess.PIPE if quiet else None,
                       stderr=subprocess.STDOUT if quiet else None, text=True)
    dt = time.time() - t0
    if r.returncode:
        if quiet and r.stdout:
            print(r.stdout[-4000:])
        print('== %s FAILED (exit %d) after %.0f s' % (name, r.returncode, dt), flush=True)
    else:
        print('== %s ok, %.0f s' % (name, dt), flush=True)
    return r.returncode


def rebuild(a):
    if a.plates:
        spec = ','.join(str(p) for p in a.plates)
        return run('preview', ['build_region_extents.py', '--plates', spec, '--dry-run', '--qc'])
    names = [n for n, _a, _w in REBUILD]
    start = names.index(a.start) if a.start else 0
    for name, argv, _what in REBUILD[start:]:
        if a.skip and name in a.skip:
            print('== %s skipped' % name)
            continue
        code = run(name, argv)
        if code:
            print('stopped at %s; resume with: python3 tools/pipeline.py rebuild --from %s'
                  % (name, name))
            return code
    print('rebuilt: %s' % ', '.join(names[start:]))
    return 0


def check(a):
    failed = []
    for name, argv in CHECK:
        if run(name, argv, quiet=a.quiet):
            failed.append(name)
    if not a.no_tests:
        if run(*TESTS, quiet=a.quiet):
            failed.append('tests')
    if failed:
        print('FAILED: %s' % ', '.join(failed))
        return 1
    print('every check clean' + ('' if a.no_tests else ', tests pass'))
    return 0


def steps(_a):
    print('rebuild, in order:')
    for name, argv, what in REBUILD:
        print('  %-9s python3 tools/%s\n%s-> %s' % (name, ' '.join(argv), ' ' * 12, what))
    print('check:')
    for name, argv in CHECK:
        print('  %-9s python3 tools/%s' % (name, ' '.join(argv)))
    print('  %-9s %s' % (TESTS[0], ' '.join(['python3'] + TESTS[1][1:])))
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter,
                                 epilog=__doc__.split('\n', 1)[1])
    sub = ap.add_subparsers(dest='cmd', required=True)
    r = sub.add_parser('rebuild', help='the build steps, in order')
    A.add_plates_arg(r)
    r.add_argument('--from', dest='start', choices=[n for n, _a, _w in REBUILD],
                   help='resume at this step')
    r.add_argument('--skip', nargs='*', choices=[n for n, _a, _w in REBUILD],
                   help='leave these steps out (when you know they cannot have moved)')
    r.set_defaults(fn=rebuild)
    c = sub.add_parser('check', help='every --check, then the tests')
    c.add_argument('--no-tests', action='store_true', help='the --check runs alone')
    c.add_argument('--quiet', action='store_true', help='show a step\'s output only if it fails')
    c.set_defaults(fn=check)
    s = sub.add_parser('steps', help='print the steps and stop')
    s.set_defaults(fn=steps)
    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == '__main__':
    sys.exit(main())
