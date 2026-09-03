"""Voxel geometry for the 3-D reconstruction.

The atlas is a coronal series 350 um apart, and everything downstream of it in this
repository is two-dimensional on purpose: `region_extents` tiles each section exactly,
`brain_outline` bounds it, and `plateAt()` in the app refuses to interpolate between
plates because an interpolated surface is arithmetic rather than anatomy. This module is
where that refusal is set aside deliberately, so it is worth saying exactly how.

Two choices carry the result.

**Shape-based interpolation, not contour lofting.** The section outline changes topology
along the series -- the interhemispheric fissure separates the hemispheres on plates
10-14, cortex parts from midbrain on 37-42, cerebellum from brainstem on 56-59 -- so a
scheme that pairs contours between neighbouring plates has nothing to pair across a
split. Interpolating the signed distance field of each mask and thresholding it at zero
needs no correspondence at all: a shape may branch, merge or vanish between two plates
and the field simply carries it.

**One competition, not one structure at a time.** Interpolating each structure's field on
its own lets neighbours overlap and leave voids in the six planes between two plates,
which throws away the property `build_region_extents.py` worked hardest for -- every
boundary stored once and shared exactly, so a point is inside one region or none. Here
every structure on a plate, plus the unassigned faces the atlas seals and declines to
name, is interpolated into the same intermediate plane and each voxel goes to whichever
field is highest. The regions then partition the volume the way they partition a section.
"""

import numpy as np
from scipy import ndimage

NW, NH = 1100, 703          # the app's plate frame, which the stored fractions are in
RES = 0.05                  # mm, isotropic
SUB = 7                     # voxels per 0.35 mm plate step; RES * SUB == the spacing
CAP = 4                     # voxels of taper beyond the first and last plate of a run
UNASSIGNED = -1             # the label for a sealed face the atlas does not name


# ---------- the frame ----------

class Frame:
    """Fractions of the 1100 x 703 plate frame into stereotaxic millimetres.

    The same two formulae the app applies -- `toML()` / `toDV()` in src/app.js, which
    is also how it reads the outlines -- taken from `plate_frame` rather than copied,
    so a recalibration moves both together."""

    def __init__(self, pf):
        self.x0 = pf['ml_zero_px']
        self.xs = pf['ml_px_per_mm']
        self.y0 = pf['dv_zero_px']
        self.ys = pf['dv_px_per_mm']

    def ml(self, xf):
        return (np.asarray(xf, float) * NW - self.x0) / self.xs

    def dv(self, yf):
        return (self.y0 - np.asarray(yf, float) * NH) / self.ys

    def rings(self, gs):
        """A stored polygon list into a list of (n, 2) millimetre arrays."""
        out = []
        for g in gs:
            a = np.asarray(g, float)
            out.append(np.stack([self.ml(a[:, 0]), self.dv(a[:, 1])], 1))
        return out


class Grid:
    """The voxel lattice: ML and DV isotropic at RES, AP with the plate planes on it.

    AP is laid out so every plate falls exactly on a sample -- plate k at index
    CAP + k*SUB -- rather than near one. A plate's own drawing is then never resampled,
    and only the six planes between two plates are interpolated, which is the whole of
    the inaccuracy this module introduces and all of it is in one place."""

    def __init__(self, ml0, ml1, dv0, dv1, aps, res=RES, sub=None, cap=CAP):
        self.res, self.cap = res, cap
        self.ml0 = float(np.floor(ml0 / res) * res)
        self.dv0 = float(np.floor(dv0 / res) * res)
        self.nx = int(np.ceil((ml1 - self.ml0) / res)) + 1
        self.ny = int(np.ceil((dv1 - self.dv0) / res)) + 1
        self.aps = np.asarray(aps, float)
        # The lattice puts plate k at index cap + k*sub, so it can only hold plates that
        # are evenly spaced, and only at a voxel that divides that spacing. Both used to
        # be assumed: a run over `--plates 5,30,45` or at `--res 0.1` laid the plates out
        # 0.35 mm apart regardless, and wrote the wrong AP into every mesh and the NIfTI.
        self.step = abs(float(self.aps[1] - self.aps[0]))
        if not np.allclose(np.diff(self.aps), self.aps[1] - self.aps[0], atol=1e-6):
            raise ValueError('the plates must be consecutive: the lattice holds one step')
        want = self.step / res
        if sub is None:
            sub = int(round(want))
        if abs(want - sub) > 1e-6:
            raise ValueError('a %g mm voxel does not divide the %g mm plate step' % (res, self.step))
        self.sub = sub
        self.nz = cap * 2 + (len(aps) - 1) * sub + 1
        self.x = self.ml0 + np.arange(self.nx) * res
        self.y = self.dv0 + np.arange(self.ny) * res
        self.z = self.aps[0] + cap * res - np.arange(self.nz) * res

    def plane(self, k):
        """Volume index of plate k, 0-based."""
        return self.cap + k * self.sub

    @property
    def shape(self):
        return (self.nz, self.ny, self.nx)

    def describe(self):
        return {'res_mm': self.res,
                'shape_zyx': list(self.shape),
                'ml_mm': [round(float(self.x[0]), 3), round(float(self.x[-1]), 3)],
                'dv_mm': [round(float(self.y[0]), 3), round(float(self.y[-1]), 3)],
                'ap_mm': [round(float(self.z[-1]), 3), round(float(self.z[0]), 3)]}


def grid_for(frame, outline, aps, res=RES, sub=None, cap=CAP, margin=0.3):
    """A lattice sized to hold every section outline, with a margin for the taper."""
    xs, ys = [], []
    for gs in outline.values():
        for r in frame.rings(gs):
            xs.append(r[:, 0])
            ys.append(r[:, 1])
    x = np.concatenate(xs)
    y = np.concatenate(ys)
    return Grid(x.min() - margin, x.max() + margin,
                y.min() - margin, y.max() + margin, aps, res, sub, cap)


# ---------- rasterizing ----------

def fill(rings, grid):
    """Even-odd fill of a set of closed rings onto the ML x DV lattice.

    Even-odd across the whole set, which is `regIn()` in src/app.js: the two hemispheres
    of a bilateral structure union, a hole subtracts, and no winding order has to be
    kept right for either. The crossings of every ring are counted on one scanline
    together, so that holds without any per-ring bookkeeping."""
    m = np.zeros((grid.ny, grid.nx), bool)
    segs = []
    for r in rings:
        a = r[:-1] if len(r) > 1 and np.allclose(r[0], r[-1]) else r
        if len(a) < 3:
            continue
        segs.append(np.stack([a, np.roll(a, -1, 0)], 1))
    if not segs:
        return m
    e = np.concatenate(segs)                        # (n, 2, 2), endpoints of every edge
    x0, y0 = e[:, 0, 0], e[:, 0, 1]
    x1, y1 = e[:, 1, 0], e[:, 1, 1]
    dy = y1 - y0
    live = dy != 0                                  # a horizontal edge crosses nothing
    x0, y0, x1, y1, dy = x0[live], y0[live], x1[live], y1[live], dy[live]
    lo, hi = np.minimum(y0, y1), np.maximum(y0, y1)
    for j, yc in enumerate(grid.y):
        # half-open in y, so a shared vertex is counted once rather than twice
        k = (lo <= yc) & (yc < hi)
        if not k.any():
            continue
        xs = np.sort(x0[k] + (yc - y0[k]) * (x1[k] - x0[k]) / dy[k])
        row = m[j]
        for a, b in zip(xs[0::2], xs[1::2]):
            i0 = int(np.ceil((a - grid.ml0) / grid.res - 1e-9))
            i1 = int(np.floor((b - grid.ml0) / grid.res + 1e-9))
            if i1 >= i0:
                row[max(i0, 0):min(i1 + 1, grid.nx)] = True
    return m


# ---------- fields ----------

def sdf(mask, res):
    """Signed distance in millimetres, positive inside.

    An empty or full mask has no boundary to measure from, so it gets a constant field
    far enough out that it neither wins a comparison wrongly nor loses one."""
    if not mask.any():
        return np.full(mask.shape, -1e3, np.float32)
    if mask.all():
        return np.full(mask.shape, 1e3, np.float32)
    inside = ndimage.distance_transform_edt(mask, sampling=res)
    outside = ndimage.distance_transform_edt(~mask, sampling=res)
    return (inside - outside).astype(np.float32)


def taper(phi, t):
    """The field a fraction `t` of the way from a plate towards nothing.

    Beyond the last plate of a run the atlas says nothing at all, so the shape is closed
    rather than extruded: the field is pushed down until at t = 1 it is negative
    everywhere and the region has ended. The cap is a taper to a point, not a flat lid,
    and it closes half a section step out -- the same half step the series already
    implies around every plate."""
    if t <= 0:
        return phi
    top = float(phi.max())
    if top <= 0:
        return phi
    return (phi - t * (top + 1e-3)).astype(np.float32)


# ---------- meshing ----------

def march(field, grid, box=None, level=0.0, stride=1):
    """Marching cubes on a signed field, returning (ml, dv, ap) millimetre vertices.

    `box` is the (z, y, x) slice the field was cut from, so a structure can be surfaced
    in its own neighbourhood rather than across the whole lattice.

    `stride` samples the field every n voxels. A distance field is smooth where the mask
    it came from is not, so reading it more coarsely costs a surface far less than
    decimating the fine mesh afterwards does: the triangles that go are the ones that were
    describing the lattice rather than the structure."""
    from skimage import measure
    if stride > 1:
        field = field[::stride, ::stride, ::stride]
    step = grid.res * stride
    if field.min() >= level or field.max() <= level:
        return np.zeros((0, 3)), np.zeros((0, 3), np.int64)
    v, f, _, _ = measure.marching_cubes(field, level=level, spacing=(step, step, step))
    z0 = y0 = x0 = 0
    if box is not None:
        z0, y0, x0 = box[0].start, box[1].start, box[2].start
    out = np.empty_like(v)                          # (z, y, x) -> (ml, dv, ap)
    out[:, 0] = grid.x[0] + (x0 * grid.res + v[:, 2])
    out[:, 1] = grid.y[0] + (y0 * grid.res + v[:, 1])
    out[:, 2] = grid.z[0] - (z0 * grid.res + v[:, 0])
    return out, f.astype(np.int64)


def mesh_volume(v, f):
    """Signed volume in mm3; the sign tells you the winding."""
    if len(f) == 0:
        return 0.0
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    return float(np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6.0)


def orient(v, f):
    """Outward winding, so back-face culling and lighting are the right way round."""
    return (v, f[:, ::-1].copy()) if mesh_volume(v, f) < 0 else (v, f)


def cluster(v, f, cell):
    """Vertex-clustering decimation, as the skull mesh on the page already uses.

    Vertices in one cell of a `cell`-millimetre lattice collapse to their mean and the
    triangles follow; a triangle whose three corners land in one cell has no area left
    and is dropped. It is not the best decimator there is, but it is a dozen lines, it is
    deterministic, and it cannot fold a surface through itself."""
    if len(v) == 0 or cell <= 0:
        return v, f
    key = np.floor(v / cell).astype(np.int64)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.ravel()
    n = uniq.shape[0]
    cnt = np.bincount(inv, minlength=n).astype(float)
    nv = np.stack([np.bincount(inv, weights=v[:, k], minlength=n) / cnt
                   for k in range(3)], 1)
    nf = inv[f]
    keep = ((nf[:, 0] != nf[:, 1]) & (nf[:, 1] != nf[:, 2]) & (nf[:, 0] != nf[:, 2]))
    nf = nf[keep]
    if len(nf):
        _, first = np.unique(np.sort(nf, axis=1), axis=0, return_index=True)
        nf = nf[np.sort(first)]
    if len(nf) == 0:
        return np.zeros((0, 3)), np.zeros((0, 3), np.int64)
    used, nf = np.unique(nf, return_inverse=True)
    return nv[used], nf.reshape(-1, 3).astype(np.int64)


def hull(points):
    """The convex hull of a point cloud, as a triangle mesh.

    What a structure the series barely samples gets instead of a surface: an enclosing
    volume, which is a claim about where the thing is and not about what shape it is."""
    from scipy.spatial import ConvexHull, QhullError
    p = np.unique(np.asarray(points, float), axis=0)
    if len(p) < 4:
        return np.zeros((0, 3)), np.zeros((0, 3), np.int64)
    try:
        h = ConvexHull(p)
    except QhullError:                     # fewer than four points off a common plane
        return np.zeros((0, 3)), np.zeros((0, 3), np.int64)
    # qhull does not promise a consistent winding, and a mesh wound both ways encloses
    # nothing, so each facet is turned to agree with its own outward plane normal
    tri = h.simplices.copy()
    a, b, c = p[tri[:, 0]], p[tri[:, 1]], p[tri[:, 2]]
    back = np.einsum('ij,ij->i', np.cross(b - a, c - a), h.equations[:, :3]) < 0
    tri[back] = tri[back][:, ::-1]
    used, f = np.unique(tri, return_inverse=True)
    return p[used], f.reshape(-1, 3).astype(np.int64)


def merge(meshes):
    """Several meshes as one, indices rebased."""
    vs, fs, n = [], [], 0
    for v, f in meshes:
        if not len(f):
            continue
        vs.append(v)
        fs.append(f + n)
        n += len(v)
    if not vs:
        return np.zeros((0, 3)), np.zeros((0, 3), np.int64)
    return np.concatenate(vs), np.concatenate(fs)


def label3(mask):
    """26-connected components of a mask.

    A bilateral structure comes out as two and a midline one as a single component that
    spans ML 0, which is the honest way round: the drawings are not perfectly symmetric
    -- plates 43 and 44 sit about a millimetre off centre -- so cutting every structure
    at ML 0 would invent a midline the atlas does not draw."""
    return ndimage.label(mask, structure=np.ones((3, 3, 3), bool))


# ---------- output ----------

def quantise(v, step=0.01):
    """Vertices onto a 0.01 mm lattice as uint16 offsets, as the skull mesh is stored."""
    o = v.min(0)
    q = np.rint((v - o) / step).astype(np.int64)
    assert q.max() < 65536, 'mesh spans more than 655 mm; widen the quantisation'
    return o, q.astype(np.uint16)


def write_nifti(path, labels, grid, descrip='', unnamed=65000):
    """The label volume as a gzipped NIfTI-1 file, one uint16 id per voxel.

    Voxels are written x fastest, in (ML, AP, DV) order so that the file reads as RAS --
    x to the animal's right, y anterior, z dorsal -- with an sform that puts each voxel
    centre at its atlas millimetres. 0 is outside the brain, `unnamed` is a sealed face
    the atlas does not name, and every other id is a structure named in the lookup table
    written beside it. Nothing here needs nibabel: the header is 348 bytes of struct."""
    import gzip
    import struct
    # cast before the where, not after: `unnamed` is 65000 and `labels` is int16, and
    # numpy 2 refuses a Python int the array's dtype cannot hold rather than widening
    # the result. The mask is read off the signed array, so UNASSIGNED still finds it.
    zyx = np.where(labels == UNASSIGNED, np.uint16(unnamed),
                   labels.astype(np.uint16))                              # (AP, DV, ML)
    arr = np.ascontiguousarray(zyx.transpose(2, 0, 1)[:, ::-1, :])        # (ML, AP asc, DV)
    nx, ny, nz = arr.shape
    res = float(grid.res)
    x0, y0, z0 = float(grid.x[0]), float(grid.z[-1]), float(grid.y[0])   # AP flipped to ascend
    h = bytearray(348)
    struct.pack_into('<i', h, 0, 348)                                  # sizeof_hdr
    struct.pack_into('<8h', h, 40, 3, nx, ny, nz, 1, 1, 1, 1)           # dim
    struct.pack_into('<h', h, 68, 1002)                                # intent_code: labels
    struct.pack_into('<hh', h, 70, 512, 16)                            # datatype uint16, bitpix
    struct.pack_into('<8f', h, 76, 1.0, res, res, res, 1.0, 1.0, 1.0, 1.0)   # pixdim
    struct.pack_into('<f', h, 108, 352.0)                              # vox_offset
    struct.pack_into('<ff', h, 112, 1.0, 0.0)                          # scl_slope, scl_inter
    struct.pack_into('<B', h, 123, 2)                                  # xyzt_units: mm
    d = ('Gerbil atlas label volume; ids in the lookup table beside it. ' + descrip)[:79]
    struct.pack_into('<80s', h, 148, d.encode('ascii', 'replace'))
    struct.pack_into('<hh', h, 252, 0, 1)                              # qform_code, sform_code
    struct.pack_into('<4f', h, 280, res, 0, 0, x0)                     # srow_x
    struct.pack_into('<4f', h, 296, 0, res, 0, y0)                     # srow_y
    struct.pack_into('<4f', h, 312, 0, 0, res, z0)                     # srow_z
    struct.pack_into('<4s', h, 344, b'n+1\0')                          # magic
    with gzip.open(path, 'wb', compresslevel=6) as fh:
        fh.write(bytes(h))
        fh.write(b'\0\0\0\0')                                          # no extensions
        fh.write(arr.tobytes(order='F'))


def write_stl(path, v, f, name='mesh'):
    with open(path, 'w', encoding='utf8', newline='') as fh:
        fh.write('solid %s\n' % name)
        for t in f:
            a, b, c = v[t[0]], v[t[1]], v[t[2]]
            n = np.cross(b - a, c - a)
            L = float(np.linalg.norm(n))
            n = n / L if L else n
            fh.write('facet normal %.5f %.5f %.5f\n outer loop\n' % tuple(n))
            for p in (a, b, c):
                fh.write('  vertex %.4f %.4f %.4f\n' % tuple(p))
            fh.write(' endloop\nendfacet\n')
        fh.write('endsolid %s\n' % name)
