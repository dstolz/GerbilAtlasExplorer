#!/usr/bin/env python3
"""Build the single-file app from `src/` and `data/`.

The app is one HTML file you can open from disk, and it stays that way. What changes
is where it comes from: `src/app.html` is the page with markers where the data goes,
`src/app.css` and `src/app.js` are the code, and everything under a marker is read from
`data/` and written into the page here. Nothing edits the built file in place any more.

Markers, each on a line of its own in `src/app.html`:

    <!-- @css app.css -->        the stylesheet, inlined
    <!-- @js app.js -->          the script, inlined
    <!-- @blob NAME -->          one data global: <script>window.__NAME__=...;</script>
    <!-- @lean-extras -->        the service worker and manifest; only in the lean page

and two tokens that can appear anywhere: {{BUILD_HASH}} and {{BUILD_DATE}}, the commit
the page was built from. A commit cannot know its own hash, so the stamp in a committed
bundle is the commit it was built *on*; CI passes the exact one with --commit.

Outputs:

    python3 tools/build_app.py                  gerbil_atlas_explorer.html, the bundle
    python3 tools/build_app.py --lean           index.html: plates as URLs, fetched on demand
    python3 tools/build_app.py --dev            build/dev.html: links ../src/app.css and
                                                ../src/app.js, so code edits need no rebuild
    python3 tools/build_app.py --site DIR       everything GitHub Pages serves, in one folder
    python3 tools/build_app.py --check          exit 1 if the committed pages are stale
    python3 tools/build_app.py --compare OLD    deep-compare OLD's data globals with a fresh
                                                render (a check for the migration, not for use)

Stdlib only, under a second.
"""
import argparse
import datetime
import json
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A  # noqa: E402

SRC = os.path.join(A.ROOT, 'src')
BUNDLE = os.path.join(A.ROOT, 'gerbil_atlas_explorer.html')
LEAN = os.path.join(A.ROOT, 'index.html')
DEV = os.path.join(A.ROOT, 'build', 'dev.html')
REPO = 'https://github.com/dstolz/GerbilAtlasExplorer'

# what a lean page adds to the head: the manifest, and the worker that caches the shell
# and each plate the first time it is shown, so the page works offline after one visit
LEAN_EXTRAS = (
    '<link rel="manifest" href="manifest.webmanifest">\n'
    '<script>if("serviceWorker" in navigator && /^https?:$/.test(location.protocol))'
    'addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));</script>'
)

SITE_FILES = ['gerbil_atlas_explorer.html', 'index.html', 'sw.js', 'manifest.webmanifest',
              '.nojekyll', 'LICENSE', 'LICENSE-DATA.md']


def stamp(commit=None, date=None):
    """The commit and date to write into the page. Git's, unless overridden."""
    def git(*args):
        try:
            return subprocess.run(['git'] + list(args), cwd=A.ROOT, capture_output=True,
                                  text=True, check=True).stdout.strip()
        except (subprocess.CalledProcessError, OSError):
            return ''
    # A committed bundle is always built on a tree that was about to be committed, so
    # the stamp is the commit it was built on (one behind the commit that carries it)
    # and the date is the day it was built when the tree was dirty, the commit's
    # otherwise. CI builds the deployed copy with --commit, and the check masks both.
    dirty = bool(git('status', '--porcelain', '--untracked-files=no'))
    if commit is None:
        commit = git('rev-parse', '--short', 'HEAD') or 'unknown'
    if date is None:
        date = (datetime.date.today().isoformat() if dirty
                else git('log', '-1', '--format=%cs') or 'undated')
    return commit[:47], date[:10]


def read(name):
    with open(os.path.join(SRC, name), encoding='utf8', newline='') as f:
        return f.read()


def blobs(db, lean=False):
    """Every data global, keyed by the marker name, as the JS text after the `=`."""
    return {
        'ATLAS':   A.dumps(A.atlas_payload(db)),
        'IMG':     A.dumps(A.images_payload('drawing', lean)),
        'BOX':     A.dumps(db['label_positions']['data']),
        'LEAD':    A.dumps(db['label_leaders']['data']),
        'OUTLINE': A.dumps(db['brain_outline']['data']),
        'SKULL':   A.dumps(A.skull_payload()),
        'NISSL':   A.dumps(A.images_payload('nissl', lean)),
        'MYELIN':  A.dumps(A.images_payload('myelin', lean)),
        'VEC':     A.dumps(A.vec_payload()),
        'REGION':  A.dumps(A.region_payload(db)),
    }


def render(db=None, lean=False, dev=False, commit='{{BUILD_HASH}}', date='{{BUILD_DATE}}'):
    """The page, as text. Tokens are left in place unless a stamp is given."""
    db = db or A.load_db()
    data = blobs(db, lean)
    out = []
    for line in read('app.html').split('\n'):
        m = re.match(r'\s*<!-- @(css|js|blob|lean-extras)(?: ([\w.]+))? -->\s*$', line)
        if not m:
            out.append(line)
            continue
        kind, arg = m.group(1), m.group(2)
        if kind == 'css':
            out.append('<link rel="stylesheet" href="../src/%s">' % arg if dev
                       else '<style>\n%s</style>' % read(arg))
        elif kind == 'js':
            out.append('<script src="../src/%s"></script>' % arg if dev
                       else '<script>\n%s</script>' % read(arg))
        elif kind == 'blob':
            if arg not in data:
                sys.exit('build_app: no such blob %r' % arg)
            out.append('<script>window.__%s__=%s;</script>' % (arg, data.pop(arg)))
        elif kind == 'lean-extras':
            if lean:
                out.append(LEAN_EXTRAS)
    if data:
        sys.exit('build_app: blobs never placed: %s' % ', '.join(sorted(data)))
    text = '\n'.join(out)
    return text.replace('{{BUILD_HASH}}', commit).replace('{{BUILD_DATE}}', date)


def write(path, text):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf8', newline='') as f:
        f.write(text)
    os.replace(tmp, path)


def unstamp(text):
    """Put the tokens back in a built page, so two builds compare without their stamps."""
    text = re.sub(r'(<meta name="gae-build" content=")[^"]*(")', r'\1{{BUILD_HASH}} {{BUILD_DATE}}\2', text)
    text = re.sub(r'(/commit/)[0-9a-zA-Z-]+(")', r'\1{{BUILD_HASH}}\2', text)
    text = re.sub(r'(<code>)[0-9a-zA-Z-]+(</code></a>), [^.<]*\.', r'\1{{BUILD_HASH}}\2, {{BUILD_DATE}}.', text)
    text = re.sub(r'(/commit/\{\{BUILD_HASH\}\}"[^>]*><code>)[0-9a-zA-Z-]+(</code>)', r'\1{{BUILD_HASH}}\2', text)
    return text


def check(db):
    """Compare the committed pages with fresh renders; report what is stale."""
    stale = 0
    for path, lean in ((BUNDLE, False), (LEAN, True)):
        if not os.path.exists(path):
            print('%s: absent' % os.path.relpath(path, A.ROOT))
            stale += 1
            continue
        with open(path, encoding='utf8', newline='') as f:
            have = unstamp(f.read())
        want = render(db, lean=lean)
        if have == want:
            print('%s: current' % os.path.relpath(path, A.ROOT))
            continue
        stale += 1
        # say which line differs, by marker name where it is a data line
        hl, wl = have.split('\n'), want.split('\n')
        for i, (a, b) in enumerate(zip(hl, wl)):
            if a != b:
                m = re.match(r'<script>window\.__(\w+)__=', b)
                what = '__%s__ blob' % m.group(1) if m else 'line %d' % (i + 1)
                print('%s: STALE at %s -- run tools/build_app.py%s'
                      % (os.path.relpath(path, A.ROOT), what, ' --lean' if lean else ''))
                break
        else:
            print('%s: STALE (length differs) -- run tools/build_app.py' % os.path.relpath(path, A.ROOT))
    return 1 if stale else 0


def compare(old, db):
    """Parse every window.__X__ in OLD and in a fresh render and compare them as data."""
    def globals_of(text):
        found = {}
        for m in re.finditer(r'window\.__(\w+)__=', text):
            name, start = m.group(1), m.end()
            obj, _ = json.JSONDecoder().raw_decode(text, start)
            found[name] = obj
        return found
    with open(old, encoding='utf8', newline='') as f:
        a = globals_of(f.read())
    b = globals_of(render(db))
    bad = 0
    for k in sorted(set(a) | set(b)):
        if k not in a or k not in b:
            print('%s: only in %s' % (k, 'old' if k in a else 'new')); bad += 1
        elif a[k] == b[k]:
            print('%s: identical' % k)
        else:
            bad += 1
            if isinstance(a[k], dict) and isinstance(b[k], dict):
                diff = [x for x in set(a[k]) | set(b[k]) if a[k].get(x) != b[k].get(x)]
                print('%s: differs in %d keys: %s' % (k, len(diff), sorted(diff, key=str)[:12]))
            else:
                print('%s: differs' % k)
    return 1 if bad else 0


def site(out, db, commit, date):
    """The folder GitHub Pages serves: both pages, the worker, the plates, the meshes."""
    os.makedirs(out, exist_ok=True)
    write(os.path.join(out, 'gerbil_atlas_explorer.html'), render(db, commit=commit, date=date))
    write(os.path.join(out, 'index.html'), render(db, lean=True, commit=commit, date=date))
    for name in SITE_FILES:
        src = os.path.join(A.ROOT, name)
        if os.path.exists(src) and name not in ('gerbil_atlas_explorer.html', 'index.html'):
            shutil.copy2(src, os.path.join(out, name))
    for sub in ('plates', 'meshes'):
        src = os.path.join(A.DATA, sub)
        if os.path.isdir(src):
            dst = os.path.join(out, 'data', sub)
            if os.path.isdir(dst):
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
    for name in ('gerbil_atlas.json', 'gerbil_atlas_volumes.json'):
        os.makedirs(os.path.join(out, 'data'), exist_ok=True)
        shutil.copy2(os.path.join(A.DATA, name), os.path.join(out, 'data', name))
    print('site written to %s' % out)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out', help='where to write the bundle (default: the repository root)')
    ap.add_argument('--lean', action='store_true', help='also build index.html, plates as URLs')
    ap.add_argument('--dev', action='store_true', help='also build build/dev.html for editing')
    ap.add_argument('--site', metavar='DIR', help='write everything Pages serves into DIR')
    ap.add_argument('--check', action='store_true', help='exit 1 if the committed pages are stale')
    ap.add_argument('--compare', metavar='OLD', help='deep-compare OLD\'s data globals with a fresh render')
    ap.add_argument('--commit', help='stamp this commit instead of git\'s HEAD')
    ap.add_argument('--date', help='stamp this date (YYYY-MM-DD) instead of the commit\'s')
    a = ap.parse_args()
    db = A.load_db()
    if a.check:
        return check(db)
    if a.compare:
        return compare(a.compare, db)
    commit, date = stamp(a.commit, a.date)
    if a.site:
        site(a.site, db, commit, date)
        return 0
    write(a.out or BUNDLE, render(db, commit=commit, date=date))
    print('wrote %s (build %s, %s)' % (os.path.relpath(a.out or BUNDLE, A.ROOT), commit, date))
    if a.lean:
        write(LEAN, render(db, lean=True, commit=commit, date=date))
        print('wrote index.html')
    if a.dev:
        write(DEV, render(db, dev=True, commit=commit, date=date))
        print('wrote build/dev.html')
    return 0


if __name__ == '__main__':
    sys.exit(main())
