#!/usr/bin/env python3
"""Retired: the app is built from src/ and data/ by tools/build_app.py.

This name is kept so that an old command still does the right thing. Run bare it
builds the app; with --check it runs the build's staleness check instead. Either
way the exit code is build_app's.

Usage:  python3 tools/inline_region_extents.py [--check]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_app  # noqa: E402


def main():
    print('inline_region_extents.py is retired: the app is built by tools/build_app.py')
    extra = [x for x in sys.argv[1:] if x != '--check']
    if extra:
        raise SystemExit('inline_region_extents.py takes only --check; run '
                         'tools/build_app.py for anything else (%s)' % ' '.join(extra))
    sys.argv = [build_app.__file__] + (['--check'] if '--check' in sys.argv[1:] else [])
    return build_app.main()


if __name__ == '__main__':
    sys.exit(main())
