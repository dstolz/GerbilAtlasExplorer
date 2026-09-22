"""tools/volume.py: the hull a structure too thin to have a surface is given instead.

`build_volumes.py` grades a structure the series barely samples `slab` and hands each of
its connected components to `hull()`, which claims the ground the component stands on
rather than its shape. A component can be too flat for that: one voxel wide on any axis
puts every center on a common plane, and a plane has no volume for qhull to hull. Before
the pad below, such a component silently contributed nothing, and a structure whose only
component was flat was published with a volume and `"mesh": null` -- which is what `mlx`
on plate 56 did once the face floor left it 0.0146 mm2, one voxel across in ML.
"""
import numpy as np
import pytest

import volume as V

RES = 0.05                                  # the grid build_volumes.py uses, in mm
PAD = RES / 2.0


def sheet(nx, ny, nz):
    """Voxel centers of an nx x ny x nz block, at the grid's spacing."""
    g = np.meshgrid(np.arange(nx), np.arange(ny), np.arange(nz), indexing='ij')
    return np.stack([a.ravel() * RES for a in g], 1)


def test_a_solid_cloud_is_the_same_hull_with_the_pad_and_without():
    """The pad is a fallback, not a dilation: what hulled before hulls unchanged."""
    p = np.random.default_rng(0).random((50, 3))
    v0, f0 = V.hull(p)
    v1, f1 = V.hull(p, pad=PAD)
    assert len(f0) and np.array_equal(v0, v1) and np.array_equal(f0, f1)


def test_a_flat_cloud_has_no_hull_without_the_pad():
    """Four voxels by ten, one voxel thick -- 40 centers on one plane."""
    v, f = V.hull(sheet(1, 10, 4))
    assert len(v) == 0 and len(f) == 0


def test_a_flat_cloud_is_hulled_over_its_voxels_with_the_pad():
    """The hull of the corners is the box those 40 voxels occupy, to the voxel."""
    v, f = V.hull(sheet(1, 10, 4), pad=PAD)
    assert len(v) == 8 and len(f) == 12
    assert abs(V.mesh_volume(v, f)) == pytest.approx(40 * RES ** 3, rel=1e-9)

    # and it encloses the centers it was built from rather than sitting inside them
    p = sheet(1, 10, 4)
    assert v[:, 0].min() < p[:, 0].min() and v[:, 0].max() > p[:, 0].max()


def test_one_voxel_is_a_cube_rather_than_nothing():
    """Fewer than four points is the other way a component was dropped."""
    assert [len(a) for a in V.hull(np.zeros((1, 3)))] == [0, 0]
    v, f = V.hull(np.zeros((1, 3)), pad=PAD)
    assert len(v) == 8 and len(f) == 12
    assert abs(V.mesh_volume(v, f)) == pytest.approx(RES ** 3, rel=1e-9)


def test_the_pad_never_shrinks_what_it_encloses():
    """A padded hull holds at least the volume its voxels do, whatever their shape."""
    rng = np.random.default_rng(1)
    for nx, ny, nz in ((1, 4, 4), (2, 1, 9), (3, 3, 1), (1, 1, 6)):
        p = sheet(nx, ny, nz)
        p = p[rng.random(len(p)) > 0.25] if len(p) > 8 else p       # a ragged one too
        v, f = V.hull(p, pad=PAD)
        assert len(f), (nx, ny, nz)
        assert abs(V.mesh_volume(v, f)) >= len(p) * RES ** 3 - 1e-12, (nx, ny, nz)
