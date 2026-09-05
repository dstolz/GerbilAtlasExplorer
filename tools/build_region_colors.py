#!/usr/bin/env python3
"""One color per region, the same on every plate the atlas draws it on.

Coloring the section as a map is a question about the whole atlas, not about one
plate. Asked plate by plate it has 62 answers, and a structure that borders three
things on plate 30 and five on plate 31 is given whatever color was free on each --
so stepping through the levels repaints half the section, and the color a reader
has just learned to read as CPu is somebody else's on the next plate. Asked once
over all 62 plates at the same time it has one answer, and that is what this
writes: `region_colors`, a palette slot per abbreviation, held wherever that
abbreviation is drawn.

What has to hold, and what it costs

    No two regions that touch may wear the same color, on any plate. That is what
    the view is for, and it is the constraint that is never bent.

    Where the atlas prints no boundary between two names, they should not be split
    by one. Two entries the extraction cut apart inside a single printed outline --
    the cerebellar lobules, the mediodorsal thalamus -- read as one structure on the
    page, and a color change through the middle of them draws a line the atlas does
    not have.

The second cannot be kept in full, and the atlas is what says so: `w` (see
build_region_extents.py) is decided per plate off that plate's own ink, and 87 of
the 189 pairs that share an unprinted border somewhere also share a printed one
somewhere else. Merge such a pair and a boundary the atlas prints disappears; split
it and one it does not print appears. The printed boundary wins, every time: a color
change where the atlas draws a line is right, and two structures the atlas separates
reading as one patch is not. So the pairs that are joined are the ones with no
printed boundary anywhere -- 102 of them -- and even those only as far as they can
be joined without swallowing a printed one along a chain of merges, which is 74.
The 28 dropped are listed in the block.

How the colors are found

    1. Two regions touch when they share a vertex or come within 0.05 mm of each
       other, plate by plate. The extents are a clean planar subdivision, so the
       first half is answered off the vertices with no tolerance at all; the second
       is the app's own rule for a lamina too thin to read as a boundary at the zoom
       a plate opens at, and it is answered by binning the boundary samples.
    2. Every pair that touches on some plate becomes an edge; every pair that touches
       with no printed boundary between them, on every plate where they touch at all,
       becomes a merge instead. Merges are taken in order and a merge is refused if it
       would put an edge inside the patch it makes.
    3. The patches are colored. Peel every patch with fewer than K neighbors off the
       graph until none is left: what remains is the K-core, and the peeled ones can
       be colored last, in the reverse of the order they came off, because each meets
       fewer than K colors when its turn comes. The core is colored by tabu search,
       from a DSATUR start, restarted with the next seed until it lands.
    4. K is the fewest that works. Eight regions in this atlas pairwise touch --
       cortical layers 1, 2 and 3 against Pir, Tu, ICj, VP and AHA -- so seven cannot
       be enough, and eight is found, which makes eight exactly the fewest. That is one
       more than a single plate ever needs, and it is what holding a color still costs.
    5. Which of the eight palette slots a patch takes is settled last, by the rule the
       app used before: every region asks for the slot hashed from its abbreviation,
       and the assignment of patches to slots that grants the most of those asks wins.
       It changes no boundary -- any relabeling of the colors is as valid -- and it
       leaves the palette turned the way the atlas's own names ask for.

The app carries the answer rather than the search: the page is opened from a file and
a two-second graph problem does not belong in a checkbox. The palette itself stays in
the app, which is where a color is chosen; nothing here knows more than that there are
eight slots to fill.

Usage:

    python3 tools/build_region_colors.py            write `region_colors` into the database
    python3 tools/build_region_colors.py --report   print what the coloring did, write nothing
    python3 tools/build_region_colors.py --check    exit 1 if the committed block is stale

Same inputs, same outputs: the search is seeded, so a re-run reproduces the block
byte for byte. Stdlib only, about five seconds.
"""
import argparse
import collections
import itertools
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A  # noqa: E402

SLOTS = 8               # palette slots the app has to fill; the colors themselves are its own
NEAR_MM = 0.05          # a gap this thin is not a boundary the eye can find, so it is a touch
SEEDS = 256             # tabu restarts before giving the color count up as too small.
                        # 64 was enough until layer 1 was located on plates 17 and 18: the
                        # band it took back from Nv moves four edges of the quotient graph,
                        # and on that graph the eighth color is found on a seed past 128.
                        # Adding SHy over plates 22 to 25 broke 256 as well -- and 1,024,
                        # which is what showed that patience was the wrong dial: every
                        # restart set out from the same DSATUR coloring. They begin
                        # somewhere else now (see color_graph), and the eighth color comes
                        # back on the nineteenth. The floor is unmoved through all of it --
                        # 1, 2, 3, AHA, ICj, Pir, Tu and VP still pairwise touch, and an
                        # exact maximum-clique search over the 631 patches returns 8 -- so
                        # a ninth color is the search giving up and never the atlas asking:
                        # MCPAL in src/app.js holds exactly eight, and a region in slot 8
                        # renders as `undefined` with no test to catch it. Read the summary
                        # after every run: `colors` must be 8, `colors_are_the_fewest` true.
KICKS = (0.75, 0.55, 0.85, 0.65, 0.50)   # shares of the start a restart kicks to random
                        # slots, cycled. Measured on the k=8 graph SHy makes: 0.05, 0.10,
                        # 0.15 and 0.35 found nothing in twenty restarts each, 0.50 found
                        # it once and 0.75 twice, and 1.00 -- which is no start at all --
                        # nothing. A gentle kick lands back in the basin it left.


# ---------------------------------------------------------------- who touches whom
def touching(regs, near):
    """Every pair of regions on one plate that share a point or all but share one.

    `regs` is {abbr: [ring, ...]} in plate pixels. The extents tile the section --
    a boundary between two of them is one polyline held twice, vertex for vertex --
    so sharing a point is answered by indexing the vertices and reading off who is
    filed under each, with no tolerance and no geometry. Sharing a corner counts:
    two regions that meet at one point read as one patch if they are painted alike.

    The near pairs are the same question about a gap instead of a corner. Every
    boundary segment is filed under the cells its own samples fall in -- sampled
    every `near`, on cells of twice that -- so a segment within `near` of a point is
    in one of the nine cells around it, and the search is nine lookups per vertex
    rather than a pass over the plate.
    """
    adj = set()

    def pair(a, b):
        adj.add((a, b) if a < b else (b, a))

    at = collections.defaultdict(set)
    for ab, rings in regs.items():
        for g in rings:
            for q in g:
                at[q].add(ab)
    for names in at.values():
        for a, b in itertools.combinations(sorted(names), 2):
            pair(a, b)

    cell = 2 * near
    bins = collections.defaultdict(list)
    for ab, rings in regs.items():
        for g in rings:
            for (ax, ay), (bx, by) in zip(g, g[1:]):
                seg = (ab, ax, ay, bx, by)
                n = max(1, math.ceil(math.hypot(bx - ax, by - ay) / near))
                for k in range(n + 1):
                    t = k / n
                    key = (int((ax + (bx - ax) * t) // cell), int((ay + (by - ay) * t) // cell))
                    box = bins[key]
                    if not box or box[-1] is not seg:   # a run of samples in one cell files once
                        box.append(seg)

    r2 = near * near
    for ab, rings in regs.items():
        for g in rings:
            for qx, qy in g:
                ci, cj = int(qx // cell), int(qy // cell)
                for di in (-1, 0, 1):
                    for dj in (-1, 0, 1):
                        for (nb, ax, ay, bx, by) in bins.get((ci + di, cj + dj), ()):
                            if nb == ab or (min(ab, nb), max(ab, nb)) in adj:
                                continue
                            if seg_d2(qx, qy, ax, ay, bx, by) <= r2:
                                pair(ab, nb)
    return adj


def seg_d2(px, py, ax, ay, bx, by):
    """Squared distance from a point to a segment: the projection where it falls on
    the segment, the nearer end where it does not."""
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L)) if L else 0.0
    ex, ey = px - (ax + t * dx), py - (ay + t * dy)
    return ex * ex + ey * ey


def read_plates(db):
    """The extents as the app builds them: rings in plate pixels, and the `w` flag."""
    NW = db['plate_frame']['width_px']
    NH = db['plate_frame']['height_px']
    out = []
    for p in sorted(db['region_extents']['data'], key=int):
        entries = db['region_extents']['data'][p]
        regs = {ab: [[(x * NW, y * NH) for x, y in g] for g in v['g']]
                for ab, v in entries.items()}
        w = {ab: bool(v.get('w')) for ab, v in entries.items()}
        out.append((int(p), regs, w))
    return out


def pairs(db):
    """Over the whole atlas: the pairs that touch, and how each plate draws them.

    A pair is counted `printed` on a plate where at least one of the two keeps an
    outline of its own there, and `open` on a plate where neither does -- which is
    the atlas printing nothing between them. The same pair can be both, on
    different plates; that is the case the block's `split_by_the_atlas` counts.
    """
    near = NEAR_MM * db['plate_frame']['ml_px_per_mm']
    printed, open_ = collections.Counter(), collections.Counter()
    regions, per_plate = set(), {}
    for plate, regs, w in read_plates(db):
        regions |= set(regs)
        adj = touching(regs, near)
        per_plate[plate] = adj
        for a, b in adj:
            (open_ if (w[a] and w[b]) else printed)[(a, b)] += 1
    return sorted(regions), printed, open_, per_plate


# ---------------------------------------------------------------- patches and colors
def patches(regions, printed, open_):
    """Join the names the atlas draws no boundary between, as far as it can be done.

    A candidate is a pair that touches with nothing printed between it and is never
    printed apart anywhere else. Taken in order -- most plates first, then by name,
    so the run does not depend on a dict's order -- and refused where the patch it
    would make has a printed boundary inside it. Returns the patch of every region
    and the candidates that had to be refused.
    """
    par = {r: r for r in regions}

    def find(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x

    members = {r: {r} for r in regions}
    walls = collections.defaultdict(set)
    for a, b in printed:
        walls[a].add(b)
        walls[b].add(a)
    cand = sorted((p for p in open_ if p not in printed), key=lambda p: (-open_[p], p))
    joined, refused = [], []
    for a, b in cand:
        x, y = find(a), find(b)
        if x == y:
            joined.append((a, b))
            continue
        if any(v in walls[u] for u in members[x] for v in members[y]):
            refused.append((a, b))
            continue
        par[x] = y
        members[y] |= members[x]
        del members[x]
        joined.append((a, b))
    patch = {}
    for r in regions:                       # name a patch for the first of its members
        patch[r] = min(members[find(r)])
    return patch, joined, refused


def quotient(regions, printed, patch):
    """The graph the coloring runs on: one node per patch, an edge for every printed
    boundary between two of them."""
    graph = {patch[r]: set() for r in regions}
    for a, b in printed:
        u, v = patch[a], patch[b]
        if u == v:                          # refused above, so this cannot happen
            raise AssertionError('a printed boundary inside one patch: %s/%s' % (a, b))
        graph[u].add(v)
        graph[v].add(u)
    return graph


def clique(graph):
    """A large clique, greedily and deterministically: every clique is a floor under
    the number of colors, since its members must all differ from one another."""
    best = []
    for v in sorted(graph):
        cl = [v]
        for u in sorted(graph[v], key=lambda u: (-len(graph[u]), u)):
            if all(u in graph[c] for c in cl):
                cl.append(u)
        if len(cl) > len(best):
            best = sorted(cl)
    return best


def peel(graph, k):
    """Strip every node with fewer than k neighbors off the graph until none is left.

    What is left is the k-core, which is the only part a search has to look at: a
    peeled node meets fewer than k colors when it is put back in the reverse of the
    order it came off, so a slot is always free for it."""
    deg = {v: len(graph[v]) for v in graph}
    left = set(graph)
    off = []
    while True:
        loose = [v for v in sorted(left) if deg[v] < k]
        if not loose:
            return sorted(left), off
        for v in loose:
            if v not in left or deg[v] >= k:
                continue
            left.discard(v)
            off.append(v)
            for u in graph[v]:
                if u in left:
                    deg[u] -= 1


def dsatur(core, graph, k):
    """A first coloring: take the node with the most colors already around it, give it
    the first slot free. Truncated at k, so it may leave conflicts for the search."""
    idx = {v: i for i, v in enumerate(core)}
    adj = [sorted(idx[u] for u in graph[v] if u in idx) for v in core]
    col = [-1] * len(core)
    seen = [set() for _ in core]
    for _ in core:
        i = max((i for i in range(len(core)) if col[i] < 0),
                key=lambda i: (len(seen[i]), len(adj[i]), -i))
        free = [c for c in range(k) if c not in seen[i]]
        if free:
            col[i] = free[0]
        else:                               # nothing free: take the least crowded slot
            n = [0] * k
            for u in adj[i]:
                if col[u] >= 0:
                    n[col[u]] += 1
            col[i] = min(range(k), key=lambda c: (n[c], c))
        for u in adj[i]:
            seen[u].add(col[i])
    return adj, col


def tabu(adj, start, k, seed, rounds):
    """Tabu search: move the vertex-color pair that costs the fewest conflicts, and
    forbid moving it back for a while. Returns a proper coloring or None.

    The tenure is drawn from a seeded generator, which is what lets the search out of
    a cycle; the seed is fixed, so the run reproduces."""
    rnd = random.Random(seed)
    col = list(start)
    n = len(col)
    at = [[0] * k for _ in range(n)]
    for i in range(n):
        for j in adj[i]:
            at[i][col[j]] += 1
    bad = sum(at[i][col[i]] for i in range(n)) // 2
    held, best = {}, bad
    for it in range(1, rounds + 1):
        if not bad:
            return col
        pick, gain = None, 1 << 30
        for i in range(n):
            ci = col[i]
            if not at[i][ci]:
                continue
            for c in range(k):
                if c == ci:
                    continue
                d = at[i][c] - at[i][ci]
                if held.get((i, c), 0) > it and bad + d >= best:
                    continue                # tabu, and no better than anything seen
                if d < gain:
                    pick, gain = (i, c), d
        if pick is None:
            continue
        i, c = pick
        was = col[i]
        for j in adj[i]:
            at[j][was] -= 1
            at[j][c] += 1
        col[i] = c
        bad += gain
        held[(i, was)] = it + 10 + rnd.randrange(max(1, (bad * 6) // 10 + 1))
        best = min(best, bad)
    return None


def color_graph(graph, k, rounds=20000):
    """Color the graph with k slots, or None. The k-core by search, the rest by
    putting the peeled nodes back into whatever is free.

    Every restart begins somewhere else. Only the tabu *tenure* was seeded before, so
    every restart set out from the one DSATUR coloring, and where that start sits in a
    bad basin they all stalled in it together: with SHy added, the k=8 search came two
    conflicts short after 1,024 restarts and twenty million moves. That reads exactly
    like a graph that needs nine colors, and it is not one -- an exact maximum-clique
    search over the 631 patches returns 8, and an eight-coloring is found in seconds
    once a restart is allowed to begin somewhere other than where the last one did.

    The kick has to be hard to be worth anything, which is the part that is not
    obvious: kicking a twentieth of the nodes, or a seventh, or a third, found nothing
    in twenty tries at each, and kicking half to three quarters found it one or two
    times in twenty. A gentle perturbation lands back in the same basin. So the
    strengths are cycled rather than fixed, and seed 0 keeps the plain DSATUR start, so
    anything the old search found on its first restart is still found on the first."""
    core, off = peel(graph, k)
    col = {}
    if core:
        adj, start = dsatur(core, graph, k)
        got = None
        for seed in range(SEEDS):
            st = start
            if seed:
                rnd = random.Random(seed)
                kick = KICKS[seed % len(KICKS)]
                st = [rnd.randrange(k) if rnd.random() < kick else c for c in start]
            got = tabu(adj, st, k, seed, rounds)
            if got:
                break
        if not got:
            return None
        col = {v: got[i] for i, v in enumerate(core)}
    for v in reversed(off):
        used = {col[u] for u in graph[v] if u in col}
        col[v] = next(c for c in range(k) if c not in used)
    return col


def turn(regions, patch, col, k):
    """Which palette slot each color takes.

    Any relabeling of the colors is as good as any other, so the one chosen is the one
    the atlas's own names ask for: every region asks for the slot hashed from its
    abbreviation, and the assignment that grants the most asks is taken. Counting is
    per region rather than per patch, so a patch of six names pulls six times."""
    want = collections.Counter()
    for r in regions:
        want[(col[patch[r]], hashed(r, k))] += 1
    grid = [[want[(c, s)] for s in range(k)] for c in range(k)]
    # the best assignment of colors to slots, over the subsets of slots already spoken
    # for: k colors placed one at a time, so 2**k states rather than k! orderings
    best = [None] * (1 << k)
    best[0] = (0, ())
    for mask in range(1 << k):
        if best[mask] is None:
            continue
        c = bin(mask).count('1')
        if c == k:
            continue
        score, taken = best[mask]
        for s in range(k):
            if mask >> s & 1:
                continue
            got = (score + grid[c][s], taken + (s,))
            if best[mask | 1 << s] is None or got > best[mask | 1 << s]:
                best[mask | 1 << s] = got
    score, perm = best[(1 << k) - 1]
    return perm, score


def hashed(ab, k):
    """The slot a name asks for. The app's own hash, kept so the two agree."""
    h = 0
    for ch in ab:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h % k


# ---------------------------------------------------------------- the block
def solve(db):
    regions, printed, open_, per_plate = pairs(db)
    patch, joined, refused = patches(regions, printed, open_)
    graph = quotient(regions, printed, patch)
    floor = clique(graph)
    k = len(floor)
    while True:
        col = color_graph(graph, k)
        if col:
            break
        k += 1
        if k > 16:
            raise SystemExit('build_region_colors: no coloring under 17 slots')
    perm, asked = turn(regions, patch, col, k)
    slot = {r: perm[col[patch[r]]] for r in regions}
    for a, b in printed:                    # the invariant, on the way out
        if slot[a] == slot[b]:
            raise AssertionError('%s and %s touch and are both slot %d' % (a, b, slot[a]))
    used = collections.Counter()
    for plate, adj in per_plate.items():
        names = {x for pair in adj for x in pair}
        used[plate] = len({slot[x] for x in names})
    return dict(regions=regions, printed=printed, open_=open_, patch=patch, joined=joined,
                refused=refused, graph=graph, floor=floor, k=k, slot=slot, asked=asked,
                used=used, per_plate=per_plate)


def block(db, s=None):
    s = s or solve(db)
    sizes = collections.Counter(s['patch'].values())
    both = sorted(p for p in s['open_'] if p in s['printed'])
    summary = {
        'regions': len(s['regions']),
        'colors': s['k'],
        'colors_are_the_fewest': len(s['floor']) == s['k'],
        'pairs_that_touch': len(s['printed']) + len(s['open_']) - len(both),
        'pairs_with_no_printed_boundary': len(s['open_']),
        'split_by_the_atlas': len(both),
        'patches': len(s['graph']),
        'names_in_the_largest_patch': max(sizes.values()),
        'merges_refused': len(s['refused']),
        'colors_on_the_busiest_plate': max(s['used'].values()),
        'regions_given_the_color_they_asked_for': s['asked'],
    }
    merged = {r: p for r, p in sorted(s['patch'].items()) if sizes[p] > 1}
    return {
        'note': 'The palette slot every region wears, on every plate it is drawn on. '
                'Solved once over all 62 plates together, because a color that holds '
                'across the atlas cannot be found one plate at a time. No two regions '
                'that touch -- share a point, or come within %s mm of one another -- are '
                'given the same slot, and beyond that a slot means nothing at all. The '
                'palette itself is the app\'s. Built by tools/build_region_colors.py.'
                % NEAR_MM,
        'derivation': DERIV % {'k': s['k'], 'floor': ', '.join(s['floor'])},
        'validation': VALID % {
            'k': s['k'], 'n': len(s['regions']), 'patches': len(s['graph']),
            'open': len(s['open_']), 'both': len(both), 'joined': len(s['joined']),
            'refused': len(s['refused']), 'plate': max(s['used'].values()),
            'floor': ', '.join(s['floor'])},
        'summary': summary,
        'refused': [list(p) for p in s['refused']],
        'merged': merged,
        'data': {r: s['slot'][r] for r in s['regions']},
    }


DERIV = (
    'Two regions touch on a plate when they share a vertex of the extents or their '
    'boundaries come within %(near)s mm. Every such pair over the 62 plates is an edge, '
    'except a pair with no printed boundary between it on any plate where it touches at '
    'all, which is a merge instead -- taken in order and refused where it would put a '
    'printed boundary inside one patch. The patches are then colored with %%(k)d slots: '
    'the k-core by tabu search from a DSATUR start, seeded so the run reproduces, and '
    'the peeled remainder in the reverse of the order it came off. %%(k)d is the fewest '
    'that can work, because %%(floor)s pairwise touch.'
) % {'near': NEAR_MM}

VALID = (
    'Every one of the %(n)d regions the atlas draws carries one slot, held on every plate '
    'it appears on. The %(n)d regions make %(patches)d patches, joined on %(joined)d of '
    'the %(open)d pairs the atlas prints no boundary between; %(refused)d joins were '
    'refused because a printed boundary ran inside the patch they would have made. '
    '%(both)d pairs are drawn open on one plate and split by a printed line on another, '
    'and the printed line decides those. No two regions that touch wear the same slot on '
    'any plate. %(k)d slots are used over the atlas and at most %(plate)d on one plate; '
    '%(k)d is the fewest possible, since %(floor)s all touch one another.'
)


def report(db):
    s = solve(db)
    b = block(db, s)
    for key, v in b['summary'].items():
        print('%-42s %s' % (key.replace('_', ' '), v))
    sizes = collections.defaultdict(list)
    for r, p in sorted(s['patch'].items()):
        sizes[p].append(r)
    print('\npatches of more than one name (%d):'
          % sum(1 for v in sizes.values() if len(v) > 1))
    for p, v in sorted(sizes.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        if len(v) > 1:
            print('  slot %d  %s' % (s['slot'][p], ' '.join(v)))
    print('\njoins refused, a printed boundary inside the patch (%d):' % len(s['refused']))
    for a, b_ in s['refused']:
        print('  %s/%s' % (a, b_))
    print('\ncolors per plate:')
    print('  ' + ' '.join('%d:%d' % (p, n) for p, n in sorted(s['used'].items())))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--report', action='store_true', help='print the coloring, write nothing')
    ap.add_argument('--check', action='store_true', help='exit 1 if the committed block is stale')
    a = ap.parse_args()
    db = A.load_db()
    if a.report:
        return report(db)
    fresh = block(db)
    if a.check:
        if db.get('region_colors') == fresh:
            print('region_colors: current')
            return 0
        print('region_colors: STALE -- run tools/build_region_colors.py')
        return 1
    if db.get('region_colors') == fresh:
        print('region_colors: unchanged (%d regions, %d colors)'
              % (len(fresh['data']), fresh['summary']['colors']))
        return 0
    # beside the extents it is read off, rather than at the end of the file
    items = [kv for kv in db.items() if kv[0] != 'region_colors']
    db.clear()
    for k, v in items:
        db[k] = v
        if k == 'region_extents':
            db['region_colors'] = fresh
    if 'region_colors' not in db:
        db['region_colors'] = fresh
    A.save_db(db)
    print('region_colors: wrote %d regions in %d colors, %d patches'
          % (len(fresh['data']), fresh['summary']['colors'], fresh['summary']['patches']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
