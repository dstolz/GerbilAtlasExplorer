"""Boundary geometry for the region extraction.

The point of this module is that neighboring regions must come out sharing
their boundary *exactly*, not approximately. Contouring each region on its own
and simplifying its ring is the obvious thing and it is wrong: Douglas-Peucker
is global to the ring it is given, so the same shared boundary, handed to it
once from each side, comes back as two different polylines. At a 2 px tolerance
they cross. The tiling then overlaps, the hit test claims a pixel twice or not
at all, and an export draws every boundary as a hairline pair.

So the boundary is traced on the crack lattice between pixels, where both
neighbors see the identical chain of corners, and it is cut at the corners
where three or more regions meet -- a purely local test, so both sides cut in
the same places. Each arc is then simplified once. Douglas-Peucker keeps its
endpoints and is symmetric under reversal, so the two sides of an arc keep the
same vertices even though they walk it in opposite directions, and the tiling
survives simplification exactly.

Sharing the boundary exactly is not the same as the boundary being drawable,
and `deburr` is the second half: the label map the boundary is traced from
carries pixel-wide burrs, and simplification turns those into spikes. It is
cleaned before it is traced, as a relabeling, so the partition -- and with it
the exact sharing above -- is untouched.
"""

import math

import numpy as np
from scipy import ndimage

# moving along an edge, the region being traced is on the right
RIGHT = {(0, 1): (1, 0), (1, 0): (0, -1), (0, -1): (-1, 0), (-1, 0): (0, 1)}
LEFT = {v: k for k, v in RIGHT.items()}


def junctions(lab):
    """Corner-lattice mask, True where three or more labels meet.

    `lab` is the region label image, 0 for unassigned. Outside the image counts
    as its own label, so the section rim is a junction wherever the region
    behind it changes."""
    H, W = lab.shape
    pad = np.full((H + 2, W + 2), -1, np.int32)
    pad[1:-1, 1:-1] = lab
    a = pad[:-1, :-1]   # the four pixels around each corner of the (H+1, W+1)
    b = pad[:-1, 1:]    # corner lattice
    c = pad[1:, :-1]
    d = pad[1:, 1:]
    n = np.ones(a.shape, np.int8)
    n += (b != a)
    n += (c != a) & (c != b)
    n += (d != a) & (d != b) & (d != c)
    return n >= 3


def deburr(lab, cap=12):
    """Give every pixel-wide sliver of a label map to the label around it.

    The watershed leaves burrs on the boundaries it settles: a pixel-wide
    tongue of one region running along the edge of another, a pixel-wide sliver
    of a third lying inside a fourth, a pixel the two of them meet at
    diagonally. Each is a third of a plate pixel across -- under the width of
    the atlas's own line, and under anything the app can draw -- and none
    survives as area worth having. What they do survive is simplification.
    Douglas-Peucker keeps whatever lies far from the chord, and the tip of a
    twenty-pixel tongue is far from it however thin the tongue, so the polygon
    comes back with a spike on it: an edge that runs out along the boundary and
    back over itself, crossing the region's own outline. That is what a reader
    sees, and the geometry underneath it is one pixel of nothing.

    A pixel is thin here when no 2x2 block of its own label contains it, which
    is the one local test that passes a staircase -- the boundaries are all
    staircases -- and fails a sliver. Thin pixels go to the nearest label that
    is not thin. That is a relabeling and not a cut: the map is still a
    partition of the same ground, so the regions still tile it and the two
    owners of a boundary still trace the identical chain of corners. Nothing
    leaves the section, and no boundary the atlas draws moves, because a
    boundary the atlas draws is wider than this.

    A label with no thick pixel anywhere is left alone rather than dissolved:
    the extraction found it a pixel wide and that is what it has.

    Run to a fixed point rather than a set number of rounds, because giving a
    sliver away can leave the pixel beside it thin in turn. It settles fast:
    over the 62 plates the first round moves a median 394 pixels of an 8 Mpx
    page, the second 26, and 29 plates want a third that moves one or two.
    None wants a fourth, so `cap` is a stop rather than a schedule.
    """
    lab = np.asarray(lab)
    for _ in range(cap):
        a, b = lab[:-1, :-1], lab[:-1, 1:]
        c, d = lab[1:, :-1], lab[1:, 1:]
        blk = (a == b) & (a == c) & (a == d) & (a > 0)
        thick = np.zeros(lab.shape, bool)
        thick[:-1, :-1] |= blk
        thick[:-1, 1:] |= blk
        thick[1:, :-1] |= blk
        thick[1:, 1:] |= blk
        thin = (lab > 0) & ~thick
        held = np.zeros(int(lab.max()) + 1, bool)
        held[lab[thick]] = True             # labels with ground of their own
        thin &= held[lab]
        if not thin.any():
            break
        near = ndimage.distance_transform_edt(
            ~thick, return_distances=False, return_indices=True)
        out = np.where(thin, lab[near[0], near[1]], lab)
        if np.array_equal(out, lab):        # thin, but nothing nearer to give it to
            break
        lab = out
    return lab


def trace_rings(mask):
    """Closed rings of a binary mask, as corner coordinates (x, y).

    Rings are traced on the crack lattice, so a ring's vertices are integer
    corners and are identical to the ones its neighbor traces. Holes come out
    as their own rings; the caller treats the set even-odd."""
    m = np.zeros((mask.shape[0] + 2, mask.shape[1] + 2), bool)
    m[1:-1, 1:-1] = mask
    edges = {}

    def add(p, q):
        edges.setdefault(p, []).append(q)

    # only a rim pixel can contribute an edge
    rim = m & ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) &
                np.roll(m, 1, 1) & np.roll(m, -1, 1))
    ys, xs = np.nonzero(rim)
    for r, c in zip(ys.tolist(), xs.tolist()):
        if not m[r - 1, c]:
            add((r, c), (r, c + 1))          # top, right
        if not m[r, c + 1]:
            add((r, c + 1), (r + 1, c + 1))  # right, down
        if not m[r + 1, c]:
            add((r + 1, c + 1), (r + 1, c))  # bottom, left
        if not m[r, c - 1]:
            add((r + 1, c), (r, c))          # left, up

    rings = []
    while edges:
        start = min(edges)
        ring = [start]
        p = start
        d = None
        while True:
            outs = edges.get(p)
            if not outs:
                break
            if len(outs) == 1 or d is None:
                q = outs[0]
            else:
                # a pinch point: hug the interior, which is on the right
                want = [RIGHT[d], d, LEFT[d], (-d[0], -d[1])]
                q = min(outs, key=lambda t: want.index(
                    (t[0] - p[0], t[1] - p[1])))
            outs.remove(q)
            if not outs:
                del edges[p]
            d = (q[0] - p[0], q[1] - p[1])
            p = q
            ring.append(p)
            if p == start:
                break
        if len(ring) >= 5:
            # (row, col) -> (x, y), and drop the pad
            rings.append([(c - 1.0, r - 1.0) for r, c in ring])
    return rings


def dp(pts, eps):
    """Douglas-Peucker, keeping both endpoints. Symmetric under reversal, which
    is what lets the two owners of an arc agree on it."""
    n = len(pts)
    if n < 3:
        return list(range(n))
    P = np.asarray(pts, float)
    keep = np.zeros(n, bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = P[i], P[j]
        vx, vy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(vx, vy)
        Q = P[i + 1:j]
        if L > 1e-12:
            d = np.abs(vx * (Q[:, 1] - a[1]) - vy * (Q[:, 0] - a[0])) / L
        else:
            d = np.hypot(Q[:, 0] - a[0], Q[:, 1] - a[1])
        k = int(np.argmax(d))
        if d[k] > eps:
            keep[i + 1 + k] = True
            stack += [(i, i + 1 + k), (i + 1 + k, j)]
    return np.nonzero(keep)[0].tolist()


def simplify_ring(ring, junc, eps):
    """Simplify a traced ring arc by arc, cutting at junction corners.

    With no junction on the ring -- a region wholly surrounded by one neighbor
    -- the ring is cut at its lexicographically smallest corner instead, which
    both owners also agree on.

    A ring can pass through the same junction twice, where the region pinches
    to a corner, and the arc between the two visits is then a closed loop --
    a lobe hanging off that corner. Douglas-Peucker has no chord to measure
    against there, only the corner itself, and what it keeps is whatever lies
    further than `eps` from it. Keep one point of a lobe and the lobe is not a
    lobe: it is a line drawn out and back over itself, which is the whisker a
    reader sees crossing the outline. So a lobe is kept when two of its points
    survive and it still encloses something, and dropped when one does. No
    threshold of its own -- `eps` decides, as it does everywhere else here.

    Dropping one leaves the arc after it starting where the arc before it
    ended, so the corner would be written twice with no edge between. Those
    repeats go too: a zero-length edge is not a boundary, and every consumer --
    the union of a division's members, the shared-edge check, an SVG export --
    would have to know to skip it."""
    n = len(ring) - 1                       # ring[-1] == ring[0]
    cuts = [i for i in range(n)
            if junc[int(ring[i][1]), int(ring[i][0])]]
    if not cuts:
        cuts = [min(range(n), key=lambda i: (ring[i][1], ring[i][0]))]
    out = []
    for a, b in zip(cuts, cuts[1:] + [cuts[0] + n]):
        arc = [ring[i % n] for i in range(a, b + 1)]
        idx = dp(arc, eps)
        if arc[0] == arc[-1] and len(idx) < 4:
            idx = [0, len(arc) - 1]
        for i in idx[:-1]:
            if not out or arc[i] != out[-1]:
                out.append(arc[i])
    while len(out) > 1 and out[0] == out[-1]:
        out.pop()
    if len(out) < 3:
        return None
    out.append(out[0])
    return out


def ring_area(ring):
    """Shoelace area in square pixels; sign carries orientation, so a hole
    inside an outer ring subtracts."""
    P = np.asarray(ring, float)
    x, y = P[:, 0], P[:, 1]
    return 0.5 * float(np.dot(x[:-1], y[1:]) - np.dot(x[1:], y[:-1]))
