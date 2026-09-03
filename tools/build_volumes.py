#!/usr/bin/env python3
"""Build the brain surface and the per-structure volumes from the plate series.

    python3 tools/build_volumes.py                      # all 62 plates, rewrites the JSON
    python3 tools/build_volumes.py --plates 27-33 --dry-run --qc
    python3 tools/build_volumes.py --stl out/           # meshes as STL as well

The atlas is 62 coronal drawings 350 um apart and nothing more. Everything three
dimensional here is therefore interpolated along AP, at seven voxels to the section step,
and that is the one inaccuracy the whole file exists to introduce. It is stated in
`volumes.note`, printed by this script, and it is why nothing below is called a
segmentation.

What comes out:

  data/gerbil_atlas_volumes.json
      `surface` -- the brain, one mesh
      `data`    -- one entry per structure: grade, components, volume, mesh
      `summary` / `validation` -- the numbers below, as figures and as prose

The meshes are base64 like the skull already on the page, because they are not readable
either way; the prose and the numbers beside them are the part a reader can check, and
`--qc` writes the pictures.
"""

import argparse
import base64
import os
import sys
import time
from collections import defaultdict

import numpy as np
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                                           # noqa: E402
import volume as V                                             # noqa: E402

BBOX_PAD = 24            # voxels (1.2 mm) of room around a structure while it competes
SPUR_LEN = 9             # voxels (0.45 mm) -- longer than one section step, see below
SURFACE_STRIDE = 3       # voxels; the brain surface is read every 0.15 mm
REGION_SAMPLES = 10      # samples wanted across a structure, which sets how coarsely
REGION_STRIDE = 6        # ... it is read, up to this many voxels (0.30 mm)
QC_PLATES = (5, 20, 30, 45, 56)


# ---------- loading ----------

def published_plates(db):
    """Which plates the authors' index lists for each abbreviation.

    Used only to tell an extraction miss from a real absence when a structure's plate run
    has a hole in it: a gap the index says is filled gets bridged, one it agrees with does
    not."""
    out = {}
    for r in db['structures']:
        out[r['abbr']] = set(r.get('plates') or [])
    return out


# ---------- runs ----------

def runs_of(ps):
    """Contiguous plate runs of a sorted plate list."""
    out = []
    for p in ps:
        if out and p == out[-1][-1] + 1:
            out[-1].append(p)
        else:
            out.append([p])
    return out


def grade_of(runs):
    """`surface` where the series samples a structure enough to have a shape, else `slab`.

    Three plates is the least that says anything about how a shape changes along the
    brain: two give a linear ramp between them and one gives nothing at all but its own
    thickness. A structure whose every run is shorter than that gets an enclosing volume
    instead of a surface, and is labelled as one."""
    return 'surface' if max(len(r) for r in runs) >= 3 else 'slab'


# ---------- the label volume ----------

def build_volume(db, frame, grid, plates, log=print):
    """Rasterize every plate, interpolate between neighbours, return the label volume.

    Returns (labels, brain, ids, planes) where `labels` is int16 over the whole lattice,
    0 outside the brain and V.UNASSIGNED on a sealed face the atlas does not name."""
    ext = db['region_extents']['data']
    una = db['region_extents']['unassigned']
    outl = db['brain_outline']['data']
    pub = published_plates(db)

    names = sorted({ab for p in plates for ab in ext.get(str(p), {})})
    ids = {ab: i + 1 for i, ab in enumerate(names)}

    # ---- per-plate masks, and the runs each structure actually has
    log('  rasterizing %d plates' % len(plates))
    masks, brain2 = {}, {}
    present = defaultdict(list)
    for p in plates:
        sp = str(p)
        brain2[p] = V.fill(frame.rings(outl[sp]), grid)
        for ab, e in ext.get(sp, {}).items():
            masks[(p, ab)] = V.fill(frame.rings(e['g']), grid)
            present[ab].append(p)
        if una.get(sp):
            masks[(p, V.UNASSIGNED)] = V.fill(frame.rings(una[sp]), grid)

    # ---- bridge a hole the published index says is an extraction miss
    bridged = 0
    for ab, ps in present.items():
        ps.sort()
        want = pub.get(ab, set())
        holes = [q for a, b in zip(ps, ps[1:]) for q in range(a + 1, b)
                 if q in want and q in plates]
        for q in holes:
            a = max(x for x in ps if x < q)
            b = min(x for x in ps if x > q)
            t = (q - a) / (b - a)
            phi = (1 - t) * V.sdf(masks[(a, ab)], grid.res) \
                + t * V.sdf(masks[(b, ab)], grid.res)
            m = (phi > 0) & brain2[q]
            if m.any():
                masks[(q, ab)] = m
                bridged += 1
        if holes:
            present[ab] = sorted(set(ps) | {q for q in holes if (q, ab) in masks})
    log('  bridged %d structure-plate holes the index lists' % bridged)

    # ---- the interpolation
    labels = np.zeros(grid.shape, np.int16)
    brain = np.zeros(grid.shape, bool)
    idx = {p: k for k, p in enumerate(plates)}

    def competitors(p):
        """Everything that lays claim to a voxel on plate p, bridged entries included.

        `masks` is the authority rather than `region_extents`, because a plate bridged
        above has a mask and no entry there."""
        return [(ids[ab] if isinstance(ab, str) else V.UNASSIGNED, m)
                for (q, ab), m in masks.items() if q == p]

    def bbox(m, pad):
        ys, xs = np.nonzero(m)
        if not len(ys):
            return None
        return (slice(max(int(ys.min()) - pad, 0), min(int(ys.max()) + pad + 1, grid.ny)),
                slice(max(int(xs.min()) - pad, 0), min(int(xs.max()) + pad + 1, grid.nx)))

    log('  interpolating %d planes' % grid.nz)
    for k in range(len(plates) - 1):
        pa, pb = plates[k], plates[k + 1]
        ca, cb = dict(competitors(pa)), dict(competitors(pb))
        keys = sorted(set(ca) | set(cb))
        empty = np.zeros((grid.ny, grid.nx), bool)
        fields = {}
        for key in keys:
            ma, mb = ca.get(key, empty), cb.get(key, empty)
            bx = bbox(ma | mb, BBOX_PAD)
            if bx is None:
                continue
            fields[key] = (bx, V.sdf(ma[bx], grid.res), V.sdf(mb[bx], grid.res),
                           key not in ca, key not in cb)   # begins / ends between them
        ba = V.sdf(brain2[pa], grid.res)
        bb = V.sdf(brain2[pb], grid.res)
        z0, z1 = grid.plane(idx[pa]), grid.plane(idx[pb])
        # both endpoints are written; the shared plate is rewritten identically by the
        # next pair, since at t = 0 and t = 1 the blend is that plate's own field
        for s in range(z1 - z0 + 1):
            z = z0 + s
            t = s / (z1 - z0)
            br = ((1 - t) * ba + t * bb) > 0
            brain[z] = br
            best = np.full((grid.ny, grid.nx), -1e9, np.float32)
            lab = np.zeros((grid.ny, grid.nx), np.int16)
            for key, (bx, fa, fb, begins, ends) in fields.items():
                # A structure the atlas draws on only one of the two plates is tapered
                # out from the plate that has it, and is NOT blended with the plate that
                # does not: the absent side's field is a large negative constant, and
                # averaging with it would swamp the taper and end the structure at the
                # plate boundary instead of half a step beyond it.
                if begins:
                    phi = V.taper(fb, min((1 - t) * V.SUB / V.CAP, 1.0))
                elif ends:
                    phi = V.taper(fa, min(t * V.SUB / V.CAP, 1.0))
                else:
                    phi = (1 - t) * fa + t * fb
                sub = best[bx]
                win = phi > sub
                if not win.any():
                    continue
                sub[win] = phi[win]
                lab[bx][win] = key
            labels[z] = np.where(br, lab, 0)
        del fields

    # ---- the caps, beyond plate 1 and plate 62
    for end, plate, direction in ((0, plates[0], +1), (grid.nz - 1, plates[-1], -1)):
        z0 = grid.plane(idx[plate])
        cs = dict(competitors(plate))
        fs = {key: V.sdf(m, grid.res) for key, m in cs.items()}
        bs = V.sdf(brain2[plate], grid.res)
        for s in range(1, grid.cap + 1):
            z = z0 - direction * s
            t = s / grid.cap
            br = V.taper(bs, t) > 0
            brain[z] = br
            best = np.full((grid.ny, grid.nx), -1e9, np.float32)
            lab = np.zeros((grid.ny, grid.nx), np.int16)
            for key, f in fs.items():
                phi = V.taper(f, t)
                win = phi > best
                best[win] = phi[win]
                lab[win] = key
            labels[z] = np.where(br, lab, 0)

    # ---- no in-brain voxel left unclaimed
    hole = brain & (labels == 0)
    if hole.any():
        _, near = ndimage.distance_transform_edt(labels == 0, return_indices=True)
        labels[hole] = labels[tuple(n[hole] for n in near)]
        log('  %d in-brain voxels filled from the nearest region' % int(hole.sum()))

    return labels, brain, ids, present


def despur(brain, log=print):
    """Take the leader-line spurs off the surface. Off by default; here is why.

    METHODS records that no morphological opening is applied to the section outline: the
    flood fill runs a few pixels out along the leader lines the drawing points at its
    abbreviations with, and an opening large enough to remove those also eats the thin
    cortical sheet on plates 36 and 38, which is real anatomy. The two are only
    inseparable in the plane. A spur is drawn on one plate; the cortical sheet runs
    through many. So the opening here is along AP alone, with an element longer than one
    section step: in principle anything confined to a single plate goes, anything that
    persists across two stays, and nothing is eroded within a section at all. The first
    and last plate are left alone, a cap being confined to one plate's neighbourhood by
    construction.

    In practice it does not separate them cleanly enough to be the default. It removes
    5.8 mm3, 0.55% of the brain, in 760 pieces spread over 58 of the 62 plates -- not the
    handful of filaments the argument predicts -- and it costs 88 printed labels their
    place inside the surface, taking containment from 97.9% to 96.5%. Some of those 88 sat
    on a spur and belong outside; which ones cannot be told from here. Left off, the
    surface contains 97.9% of the printed labels against the 97.8% the 2-D outline
    reports, which is the agreement worth having. So the geometry is left honest, as the
    2-D extraction left it, and this is a flag rather than a step."""
    el = np.ones((SPUR_LEN, 1, 1), bool)
    out = ndimage.binary_opening(brain, structure=el)
    keep = np.zeros(brain.shape[0], bool)
    keep[:V.CAP + V.SUB] = keep[-(V.CAP + V.SUB):] = True
    out[keep] = brain[keep]
    log('  spur opening removed %d voxels (%.3f%%)' %
        (int(brain.sum() - out.sum()), 100 * (1 - out.sum() / max(brain.sum(), 1))))
    return out


# ---------- meshing ----------

def surface_mesh(field_mask, grid, stride, box=None):
    """Isosurface of a mask, taken from the mask's own signed distance field.

    Marching cubes on a binary mask gives a staircase; on the mask's distance field it
    gives the surface midway between the voxels that are in and the voxels that are out,
    which is where the boundary the drawing printed actually was.

    Coarseness is set by how finely the field is read, not by decimating the mesh
    afterwards. A distance field is smooth where the mask it came from is not, so reading
    it every `stride` voxels drops the triangles that were describing the lattice and
    keeps the ones describing the structure. Vertex clustering, the obvious alternative,
    is worse where it matters: measured over all 432 structures graded `surface` and tuned
    to the same triangle count, it costs about the same median but two to four times as
    much in the tail -- at a million triangles, 7.4% median and 39.8% at the 90th
    percentile, against 6.1% and 16.7% here.

    Returns (v, f, full) with the volume of the same surface read at full resolution, so
    what the coarsening costs is a number in the file rather than an assurance."""
    phi = V.sdf(field_mask, grid.res)
    v0, f0 = V.march(phi, grid, box)
    if len(f0) == 0:
        return v0, f0, 0.0
    v0, f0 = V.orient(v0, f0)
    full = abs(V.mesh_volume(v0, f0))
    if stride <= 1:
        return v0, f0, full
    v, f = V.march(phi, grid, box, stride=stride)
    if len(f) < 8:
        return v0, f0, full
    v, f = V.orient(v, f)
    return v, f, full


def mesh_stride(volume_mm3, grid, samples=REGION_SAMPLES, coarsest=REGION_STRIDE):
    """How coarsely a structure of this size may be read, in voxels.

    A flat stride would erase the small structures -- `SLu` is 0.05 mm2 on a plate, and
    four voxels is most of the way across it -- so the target is a fixed number of samples
    across the structure rather than a fixed spacing. Ten costs a median 2.8% of a mesh's
    volume and 9.8% at the 90th percentile, which is below the 4.1% the voxel lattice
    itself already costs; going finer buys precision the lattice does not have."""
    L = float(volume_mm3) ** (1 / 3.0) if volume_mm3 > 0 else 0.0
    return int(min(coarsest, max(1, round(L / (samples * grid.res)))))


def pad_box(mask, pad, shape):
    zs, ys, xs = np.nonzero(mask)
    if not len(zs):
        return None
    def sl(a, n):
        return slice(max(int(a.min()) - pad, 0), min(int(a.max()) + pad + 1, n))
    return (sl(zs, shape[0]), sl(ys, shape[1]), sl(xs, shape[2]))


def encode(v, f):
    """Mesh to base64, quantised to 0.01 mm as the skull mesh on the page is.

    Little-endian whatever the machine, which is what the note promises and what
    the page's typed arrays read."""
    if len(f) == 0:
        return None
    o, q = V.quantise(v)
    idx = f.astype('<u4') if len(v) > 65535 else f.astype('<u2')
    return {'o': [round(float(x), 4) for x in o],
            'nv': int(len(v)), 'nf': int(len(f)),
            'v': base64.b64encode(q.astype('<u2').tobytes()).decode(),
            'f': base64.b64encode(idx.tobytes()).decode(),
            'fw': 4 if len(v) > 65535 else 2}


# ---------- validation ----------

def in_outline(polys, x, y):
    """Even-odd over one plate's outline polygons, as the app's regIn() reads them."""
    c = False
    for g in polys:
        c ^= A.pip(g, x, y)
    return c


def validate(db, frame, grid, labels, brain, raw, ids, present, meshes, plates,
             log=print):
    ext = db['region_extents']['data']
    lp = db['label_positions']['data']
    outl = db['brain_outline']['data']
    idx = {p: k for k, p in enumerate(plates)}
    res2 = grid.res ** 2
    out = {}

    # (1) cross-section area on a plate the structure was built from
    rel = []
    for p in plates:
        z = grid.plane(idx[p])
        sl = labels[z]
        for ab, e in ext.get(str(p), {}).items():
            a = float((sl == ids[ab]).sum()) * res2
            if e['a'] > 0.05:                     # below a mm2/20 the lattice is the error
                rel.append(abs(a - e['a']) / e['a'])
    rel = np.array(rel)
    out['section_area_median_rel_error'] = round(float(np.median(rel)), 4)
    out['section_area_p90_rel_error'] = round(float(np.percentile(rel, 90)), 4)

    # (2) the partition holds in 3-D: a voxel is inside one region or none. It holds by
    #     construction -- one argmax writes one label -- so the check that means anything
    #     is that nothing inside the surface was left unwritten
    inb = int(brain.sum())
    named = int(((labels > 0) & brain).sum())
    unnamed = int(((labels == V.UNASSIGNED) & brain).sum())
    assert named + unnamed == inb, 'the label volume does not cover the brain exactly'
    out['regions_partition_the_volume'] = True
    out['brain_volume_mm3'] = round(inb * grid.res ** 3, 3)
    out['unnamed_fraction'] = round(unnamed / max(inb, 1), 4)

    # (3) the two checks the 2-D outline already passes, in 3-D
    zs, ys, xs = np.nonzero(brain)
    out['dv_highest_mm'] = round(float(grid.y[ys.max()]), 3)
    out['dv_lowest_mm'] = round(float(grid.y[ys.min()]), 3)

    # (4) every printed label inside the region it names, at its own plate. Where the
    #     atlas typesets two names into one printed label -- "S1Tr/ LPtA", "Au1 (A1)" --
    #     they name one region between them and only one of them carries the extent, so
    #     either name counts as a hit on the one outline they share
    blocks = db.get('label_blocks', {}).get('data', {})
    hit = rtot = tot = inside = before = plane = 0
    for p in plates:
        z = grid.plane(idx[p])
        sl = labels[z]
        br, raw_br = brain[z], raw[z]
        joined = {}
        for g in blocks.get(str(p), []):
            for a in g:
                joined[a] = {ids[b] for b in g if b in ids}
        # where a label says its structure is: the end of the line the atlas draws
        # from it where there is one, the word itself where there is not. See
        # `label_leaders` -- reading the word for a label set outside its region
        # would score the atlas's own typesetting as a miss.
        lead = db.get('label_leaders', {}).get('data', {}).get(str(p), {})
        for ab, boxes in lp.get(str(p), {}).items():
            want = joined.get(ab) or ({ids[ab]} if ab in ids else set())
            tips = {i: (tx, ty) for i, tx, ty in lead.get(ab, [])}
            for k, (cx, cy, w, h) in enumerate(boxes):
                cx, cy = tips.get(k, (cx, cy))
                x = int(round((float(frame.ml(cx)) - grid.x[0]) / grid.res))
                y = int(round((float(frame.dv(cy)) - grid.y[0]) / grid.res))
                if not (0 <= x < grid.nx and 0 <= y < grid.ny):
                    continue
                tot += 1
                inside += bool(br[y, x])
                before += bool(raw_br[y, x])
                plane += in_outline(outl[str(p)], cx, cy)
                # A name that is no region -- a fissure, `cbw`, a vessel; see
                # atlaslib.FEATURES -- has none to be inside, so it is asked
                # whether it is in the section and not whose ground it is on.
                if ab in A.FEATURES:
                    continue
                rtot += 1
                if sl[y, x] in want:
                    hit += 1
    out['labels_in_their_own_region'] = round(hit / max(rtot, 1), 4)
    out['labels_inside_the_surface'] = round(inside / max(tot, 1), 4)
    if not np.array_equal(brain, raw):
        out['labels_inside_before_opening'] = round(before / max(tot, 1), 4)
    # the same two checks in the plane, which is what the prose sets the 3-D figures
    # against: the outline read here on the same points, the region as
    # region_extents already reports it over every plate
    out['labels_inside_the_outline_in_plane'] = round(plane / max(tot, 1), 4)
    out['labels_in_their_own_region_in_plane'] = \
        db['region_extents']['summary']['label_inside_its_own_region']

    # (5) what the meshing costs, split into its two causes so neither hides the other:
    #     reading the distance field coarsely, which is chosen, and the half-voxel by
    #     which an isosurface sits inside the voxels it was cut from, which is not an
    #     error at all but the difference between a surface and a pile of cubes
    dec = [m['coarsening_rel_error'] for m in meshes.values()
           if m['grade'] == 'surface' and m['mesh']]
    vox = [abs(m['mesh_volume_mm3'] - m['volume_mm3']) / m['volume_mm3']
           for m in meshes.values() if m['grade'] == 'surface' and m['volume_mm3']]
    if dec:
        out['coarsening_median_rel_error'] = round(float(np.median(dec)), 4)
        out['coarsening_p90_rel_error'] = round(float(np.percentile(dec, 90)), 4)
    if vox:
        out['mesh_vs_voxel_median_rel_error'] = round(float(np.median(vox)), 4)

    # (6) how cleanly a structure comes out as the one or two pieces anatomy expects.
    #     A thin sheet -- CA1, the ventricle slits -- can pinch off between two plates
    #     and arrive as several, so this is reported rather than closed up: closing it
    #     would mean growing a structure into a neighbour, and the partition is worth
    #     more than the tidy component count
    ncomp = [len(m['components']) for m in meshes.values() if m['components']]
    scrap = []
    for m in meshes.values():
        vs = sorted((c['volume_mm3'] for c in m['components']), reverse=True)
        if len(vs) > 2 and sum(vs):
            scrap.append(sum(vs[2:]) / sum(vs))
    out['structures_in_one_or_two_pieces'] = round(
        sum(1 for n in ncomp if n <= 2) / max(len(ncomp), 1), 4)
    if scrap:
        out['fragment_share_when_more_median'] = round(float(np.median(scrap)), 4)
    return out


# ---------- QC ----------

def colour(ab):
    """A stable colour per abbreviation, so two QC runs are diffable."""
    import colorsys
    r = (int.from_bytes(ab.encode()[:6].ljust(6, b'\0'), 'big') * 2654435761) % (1 << 32)
    c = colorsys.hsv_to_rgb((r % 360) / 360.0, 0.55 + ((r >> 9) % 30) / 100.0,
                            0.65 + ((r >> 17) % 30) / 100.0)
    return tuple(int(255 * x) for x in c)


def qc_planes(db, frame, grid, labels, ids, plates, log=print):
    from PIL import Image
    inv = {v: k for k, v in ids.items()}
    idx = {p: k for k, p in enumerate(plates)}
    for p in QC_PLATES:
        if p not in idx or p + 1 not in idx:
            continue
        z0 = grid.plane(idx[p])
        cols = []
        for z, cap in ((z0, 'plate %d' % p),
                       (z0 + V.SUB // 2, 'interpolated'),
                       (grid.plane(idx[p + 1]), 'plate %d' % (p + 1))):
            sl = labels[z]
            img = np.zeros((grid.ny, grid.nx, 3), np.uint8)
            for key in np.unique(sl):
                if key == 0:
                    continue
                c = (90, 90, 100) if key == V.UNASSIGNED else colour(inv[key])
                img[sl == key] = c
            cols.append(img)
        strip = np.concatenate([np.pad(c, ((0, 0), (0, 6), (0, 0))) for c in cols], 1)
        Image.fromarray(strip[::-1]).save(os.path.join(A.QCDIR, 'chk_vol_%02d.png' % p))
        log('  qc/chk_vol_%02d.png' % p)


def qc_projections(grid, brain, labels, ids, log=print):
    """Depth-shaded views of the surface, and the same views tinted by region.

    A silhouette says only that something is there. Shading the nearest surface a ray
    meets by how far away it is shows the shape, which is what is being claimed here and
    so what a reader should be able to disbelieve. Three views: sagittal (AP x DV),
    top-down (AP x ML) and coronal (ML x DV), dorsal up and anterior left."""
    from PIL import Image
    inv = {v: k for k, v in ids.items()}
    lut = np.zeros((max(inv) + 2, 3), np.uint8)
    for key, ab in inv.items():
        lut[key] = colour(ab)
    lut[0] = (105, 105, 112)              # the sealed faces the atlas does not name

    def panel(axis, orient, tinted):
        hit = brain.any(axis)
        first = brain.argmax(axis)
        n = brain.shape[axis]
        shade = np.where(hit, 0.30 + 0.70 * (1 - first / max(n - 1, 1)), 0.0)
        if tinted:
            lab = np.squeeze(np.take_along_axis(
                labels, np.expand_dims(first, axis), axis), axis)
            rgb = lut[np.clip(lab, 0, lut.shape[0] - 1)].astype(np.float32)
        else:
            rgb = np.full(first.shape + (3,), 235.0)
        img = np.clip(rgb * shade[..., None], 0, 255).astype(np.uint8)
        return orient(img)

    # z is AP index (0 = anterior), y is DV index (0 = ventral), x is ML index
    views = ((2, lambda a: a.transpose(1, 0, 2)[::-1]),      # [z, y] -> DV down, AP right
             (1, lambda a: a.transpose(1, 0, 2)),            # [z, x] -> ML down, AP right
             (0, lambda a: a[::-1]))                         # [y, x] -> DV down, ML right
    for name, tinted in (('surface', False), ('regions', True)):
        ps = [panel(ax, orient, tinted) for ax, orient in views]
        h = max(p.shape[0] for p in ps)
        w = sum(p.shape[1] for p in ps) + 6 * (len(ps) - 1)
        sheet = np.zeros((h, w, 3), np.uint8)
        x = 0
        for p in ps:
            sheet[:p.shape[0], x:x + p.shape[1]] = p
            x += p.shape[1] + 6
        Image.fromarray(sheet).save(os.path.join(A.QCDIR, 'chk_vol_%s.png' % name))
        log('  qc/chk_vol_%s.png' % name)


# ---------- main ----------

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    A.add_plates_arg(ap)
    ap.add_argument('--dry-run', action='store_true', help='report and write no JSON')
    ap.add_argument('--qc', action='store_true', help='write qc/chk_vol_*.png')
    ap.add_argument('--stl', metavar='DIR', help='also write meshes as STL')
    ap.add_argument('--nifti', metavar='PATH',
                    help='also write the label volume as a gzipped NIfTI-1 file (uint16 ids), '
                         'with a lookup table beside it')
    ap.add_argument('--res', type=float, default=V.RES, help='voxel mm (default 0.05)')
    ap.add_argument('--samples', type=int, default=REGION_SAMPLES,
                    help='samples across a structure; lower is coarser (default %d)'
                         % REGION_SAMPLES)
    ap.add_argument('--despur', action='store_true',
                    help='open the surface along AP to take off the leader-line spurs; '
                         'off by default, see despur()')
    a = ap.parse_args()

    t0 = time.time()
    db = A.load_db()
    frame = V.Frame(db['plate_frame'])
    allp = sorted(int(p) for p in db['brain_outline']['data'])
    want = set(a.plates or allp)
    plates = [p for p in allp if p in want]
    if len(plates) < 2:
        sys.exit('need at least two plates; the third dimension comes from the gap')

    aps = {p['plate']: p['bregma'] for p in db['plates']}
    grid = V.grid_for(frame, {str(p): db['brain_outline']['data'][str(p)]
                              for p in plates}, [aps[p] for p in plates], res=a.res)
    print('grid  %s' % grid.describe())
    print('      %.1f M voxels' % (np.prod(grid.shape) / 1e6))

    labels, brain, ids, present = build_volume(db, frame, grid, plates)
    raw_brain = brain
    if a.despur:
        brain = despur(brain)
        labels = np.where(brain, labels, 0).astype(np.int16)

    # ---- meshes
    print('  meshing')
    meshes = {}
    vox = grid.res ** 3
    for ab, key in sorted(ids.items(), key=lambda kv: kv[1]):
        m = labels == key
        n = int(m.sum())
        if not n:
            continue
        rs = runs_of(sorted(present[ab]))
        g = grade_of(rs)
        vol = n * vox
        stride = mesh_stride(vol, grid, a.samples)
        box = pad_box(m, 2 * stride + 2, grid.shape)
        lab, ncomp = V.label3(m[box])
        if g == 'surface':
            v, f, full = surface_mesh(m[box], grid, stride, box)
        else:
            # one hull per connected component, never one over all of them: a bilateral
            # pair hulled together would span the midline and claim the brain between
            v, f = V.merge(
                V.hull(np.stack([grid.x[box[2].start + xs], grid.y[box[1].start + ys],
                                 grid.z[box[0].start + zs]], 1))
                for c in range(1, ncomp + 1)
                for zs, ys, xs in [np.nonzero(lab == c)])
            full = abs(V.mesh_volume(v, f))
        comps = []
        for c in range(1, ncomp + 1):
            cv = int((lab == c).sum())
            if cv * vox < 1e-3:
                continue
            zs, ys, xs = np.nonzero(lab == c)
            comps.append({'volume_mm3': round(cv * vox, 4),
                          'centre_mm': [round(float(grid.x[box[2].start + xs].mean()), 2),
                                        round(float(grid.y[box[1].start + ys].mean()), 2),
                                        round(float(grid.z[box[0].start + zs].mean()), 2)]})
        meshes[ab] = {
            'grade': g,
            'bounding': g == 'slab',
            'plates': sorted(present[ab]),
            'runs': [[r[0], r[-1]] for r in rs],
            'volume_mm3': round(vol, 4),
            'mesh_volume_mm3': round(abs(V.mesh_volume(v, f)), 4),
            'coarsening_rel_error': round(
                abs(abs(V.mesh_volume(v, f)) - full) / full, 4) if full else 0.0,
            'components': comps,
            'mesh': encode(v, f),
        }
        if a.stl and len(f):
            os.makedirs(a.stl, exist_ok=True)
            V.write_stl(os.path.join(a.stl, '%s.stl' % ab.replace('/', '_')), v, f, ab)

    print('  brain surface')
    bv, bf, bfull = surface_mesh(brain, grid, SURFACE_STRIDE)
    print('    %d vertices, %d triangles, %.2f mm3' %
          (len(bv), len(bf), abs(V.mesh_volume(bv, bf))))
    if a.stl:
        os.makedirs(a.stl, exist_ok=True)
        V.write_stl(os.path.join(a.stl, 'brain_surface.stl'), bv, bf, 'brain')

    # ---- numbers
    val = validate(db, frame, grid, labels, brain, raw_brain, ids, present, meshes,
                   plates)
    val['spur_opening'] = 'on' if a.despur else 'off'
    if a.despur:
        val['spur_opening_removed_mm3'] = round(
            float(raw_brain.sum() - brain.sum()) * vox, 3)
    ngrade = defaultdict(int)
    for m in meshes.values():
        ngrade[m['grade']] += 1
    summary = {
        'plates': len(plates),
        'voxel_mm': grid.res,
        'ap_step_mm': round(grid.res, 4),
        'ap_interpolation_factor': int(round(0.35 / grid.res)),
        'structures': len(meshes),
        'graded_surface': ngrade['surface'],
        'graded_slab': ngrade['slab'],
        'surface_triangles': int(len(bf)),
        'surface_sample_mm': round(SURFACE_STRIDE * grid.res, 3),
        'region_samples_across': a.samples,
        'surface_coarsening_rel_error': round(
            abs(abs(V.mesh_volume(bv, bf)) - bfull) / bfull, 4) if bfull else 0.0,
        'region_triangles': int(sum(m['mesh']['nf'] for m in meshes.values()
                                    if m['mesh'])),
        'brain_volume_mm3': val['brain_volume_mm3'],
    }
    print()
    for k, v in summary.items():
        print('  %-28s %s' % (k, v))
    print()
    for k, v in val.items():
        print('  %-28s %s' % (k, v))
    print('\n  %.0f s' % (time.time() - t0))

    if a.qc:
        os.makedirs(A.QCDIR, exist_ok=True)
        qc_planes(db, frame, grid, labels, ids, plates)
        qc_projections(grid, brain, labels, ids)

    if a.nifti:
        names = {s['abbr']: s['name'] for s in db['structures']}
        V.write_nifti(a.nifti, np.where(brain, labels, 0), grid,
                      descrip='Radtke-Schuller et al. 2016; not a segmentation')
        lut = os.path.splitext(os.path.splitext(a.nifti)[0])[0] + '_lut.csv'
        with open(lut, 'w', encoding='utf8', newline='') as fh:
            fh.write('id,abbr,name\r\n0,,outside the brain\r\n')
            for ab, key in sorted(ids.items(), key=lambda kv: kv[1]):
                fh.write('%d,%s,"%s"\r\n' % (key, ab, names.get(ab, '').replace('"', '""')))
            fh.write('65000,,a sealed face the atlas does not name\r\n')
        print('wrote %s (%.1f MB) and %s' % (a.nifti, os.path.getsize(a.nifti) / 1e6, lut))

    if a.dry_run:
        print('\n--dry-run: nothing written')
        return
    if A.refuse_partial_write(a, 'the volumes'):
        return

    payload = {
        'note': NOTE,
        'derivation': DERIVATION,
        'validation': validation_text(summary, val),
        'grid': grid.describe(),
        'summary': summary,
        'grades': GRADES,
        'surface': {'note': SURFACE_NOTE, 'mesh': encode(bv, bf)},
        'data': meshes,
    }
    A.save_json(payload, A.VOLUMES)
    print('\nwrote %s (%.1f MB)' % (A.VOLUMES, os.path.getsize(A.VOLUMES) / 1e6))


GRADES = {
    'surface': 'at least three consecutive plates, so the series says something about how '
               'the shape changes along the brain; the mesh follows the drawn boundaries, '
               'interpolated between plates.',
    'slab': 'one or two plates only. The series does not sample the structure along AP, so '
            'the mesh is an enclosing volume -- a claim about where the structure is, not '
            'about what shape it is -- closed half a section step beyond the plates that '
            'name it.',
}

NOTE = ('Three-dimensional extent of the brain and of each structure, built by stacking '
        'the 62 coronal plates and interpolating between them. Meshes are quantised to '
        '0.01 mm and base64-encoded as the skull mesh on the page is; `o` is the corner '
        'the offsets are measured from, `v` the uint16 vertex offsets, `f` the triangle '
        'indices at `fw` bytes each. Both are little-endian: `v` decodes to nv*3 uint16, '
        'each vertex an (ML, DV, AP) offset from `o` in steps of 0.01 mm, and `f` to nf*3 '
        'unsigned indices of `fw` bytes each (2, or 4 where a mesh has more than 65535 '
        'vertices). Coordinates are stereotaxic millimetres, '
        '(ML, DV, AP), the same frame the rest of the database uses. `grade` says whether '
        'a mesh follows the drawn boundary or merely encloses the structure; see `grades`.')

DERIVATION = (
    'Built by tools/build_volumes.py from brain_outline and region_extents, both of which '
    'are fractions of the 1100 x 703 plate frame and are read into millimetres with the '
    'plate_frame formulae. Each plate is rasterized onto a 0.05 mm lattice by an even-odd '
    'fill across all of a structure\'s rings, which is the rule the app\'s own hit test '
    'uses, so the two hemispheres union and a hole subtracts. AP is laid out so every '
    'plate falls exactly on a sample and only the six planes between two plates are '
    'interpolated. Interpolation is shape-based: the signed distance field of each mask is '
    'blended between neighbouring plates and thresholded at zero, which needs no '
    'correspondence between contours and so survives the places where the section outline '
    'splits and rejoins. Every structure on a plate competes in the same intermediate '
    'plane, together with the unassigned faces the atlas seals and declines to name, and '
    'each voxel goes to the highest field -- so the regions partition the volume the way '
    'region_extents partitions a section, rather than overlapping in the gap. Beyond the '
    'first and last plate of a run the field is tapered to nothing over half a section '
    'step, closing the shape rather than extruding it. A hole in a structure\'s plate run '
    'is bridged only where the published index lists the missing plate, so an extraction '
    'miss is filled and a real absence is not. Surfaces are marching cubes on the distance '
    'field of the label volume, decimated by vertex clustering. See METHODS.md.')

SURFACE_NOTE = (
    'The brain surface: the section outlines of all 62 plates, interpolated along AP and '
    'surfaced. The leader-line spurs that METHODS leaves on the 2-D outline -- where the '
    'flood fill runs out along the lines the drawing points at its abbreviations with -- '
    'are removed here by an opening along AP alone, with an element longer than one '
    'section step. A spur is drawn on one plate and the thin cortical sheet runs through '
    'many, so this separates them without eroding anything within a section, which is what '
    'the 2-D extraction could not do.')


def validation_text(s, v):
    return (
        'The series is 350 um apart and this is 50 um along AP, so six planes in seven are '
        'interpolated and none of them is anatomy. What can be checked is that the '
        'interpolation did not move the plates. On a plate a structure was built from, the '
        'cross-section of its volume against the area region_extents records for it: '
        'median %.1f%% off, 90th percentile %.1f%%. The regions partition the volume: '
        'every voxel inside the surface carries exactly one label or is one of the sealed '
        'faces the atlas does not name, which is %.1f%% of the brain. The two checks the '
        '2-D outline already passes hold in 3-D: the surface reaches DV %.2f and does not '
        'cross it, and its lowest point is DV %.2f. Of the printed abbreviations, %.1f%% '
        'fall inside the surface and %.1f%% inside the region they name, against %.1f%% '
        'and %.0f%% for the same checks in the plane. Reading the distance field coarsely for '
        'the larger structures, rather than decimating their meshes, costs a median '
        '%.1f%% of a mesh volume. '
        '%d structures are graded surface and %d slab, and %.0f%% arrive as the one or two '
        'pieces anatomy expects; where a thin sheet pinches off into more, a median '
        '%.0f%% of it sits outside the largest two. ' % (
            100 * v['section_area_median_rel_error'], 100 * v['section_area_p90_rel_error'],
            100 * v['unnamed_fraction'], v['dv_highest_mm'], v['dv_lowest_mm'],
            100 * v['labels_inside_the_surface'], 100 * v['labels_in_their_own_region'],
            100 * v['labels_inside_the_outline_in_plane'],
            100 * v['labels_in_their_own_region_in_plane'],
            100 * v.get('coarsening_median_rel_error', 0),
            s['graded_surface'], s['graded_slab'],
            100 * v['structures_in_one_or_two_pieces'],
            100 * v.get('fragment_share_when_more_median', 0)))


if __name__ == '__main__':
    main()
