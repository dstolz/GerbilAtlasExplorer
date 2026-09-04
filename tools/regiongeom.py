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
"""

import math

import numpy as np

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
    both owners also agree on."""
    n = len(ring) - 1                       # ring[-1] == ring[0]
    cuts = [i for i in range(n)
            if junc[int(ring[i][1]), int(ring[i][0])]]
    if not cuts:
        cuts = [min(range(n), key=lambda i: (ring[i][1], ring[i][0]))]
    out = []
    for a, b in zip(cuts, cuts[1:] + [cuts[0] + n]):
        arc = [ring[i % n] for i in range(a, b + 1)]
        idx = dp(arc, eps)
        out.extend(arc[i] for i in idx[:-1])
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
