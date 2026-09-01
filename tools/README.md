# tools

The region extraction and the volume build. Everything else in this repository is data with
its derivation written out in prose in [METHODS.md](../METHODS.md), which is enough when the
derivation is a fit with six numbers in it. These two are a segmentation cut out of a line
drawing and a third axis invented between the plates, and prose alone would not let anyone
check either.

| Script | What it does |
| --- | --- |
| `build_region_extents.py` | Cuts `region_extents` out of the tracings in `svg/` and the located abbreviations in `label_positions`, and writes it into `data/gerbil_atlas.json`. |
| `regiongeom.py` | The boundary geometry: crack-lattice tracing, junction detection, arc-wise Douglas-Peucker. Kept apart because it is the part that has to be right for the regions to tile. |
| `inline_region_extents.py` | Copies `region_extents` from the JSON into the app as `window.__REGION__`, so the single file stays self-contained and the JSON stays the readable source. |
| `build_volumes.py` | Stacks the 62 plates, interpolates between them, and writes the brain surface and one mesh per structure to `data/gerbil_atlas_volumes.json`. |
| `volume.py` | The voxel geometry: the even-odd fill, the distance fields, marching cubes, hulls. Kept apart for the same reason `regiongeom.py` is — it holds the part that decides whether the regions still partition the volume. |

```
pip install numpy scipy scikit-image pillow

python3 tools/build_region_extents.py                  # all 62 plates, ~3 min, rewrites the JSON
python3 tools/build_region_extents.py --plates 30 --dry-run --qc
python3 tools/inline_region_extents.py                 # then re-inline into the app
python3 tools/inline_region_extents.py --check         # is the app's copy current

python3 tools/build_volumes.py                         # all 62 plates, ~3 min, 21 MB of meshes
python3 tools/build_volumes.py --plates 28-33 --dry-run --qc
python3 tools/build_volumes.py --samples 6             # coarser meshes, a quarter the size
python3 tools/build_volumes.py --stl out/              # the same meshes as STL
```

`--dry-run` reports and touches nothing. `--qc` writes `qc/chk_regions_NN.png`, the plate
with its regions tinted by how much of each boundary the atlas actually prints; from
`build_volumes.py` it writes `qc/chk_vol_NN.png`, a plate beside the plane interpolated
halfway to the next one, which is the check that catches an interpolation nobody would
believe.

The run prints the verification numbers as it goes and stores them in
`region_extents.summary`; `region_extents.validation` is the same numbers as prose. The one
to watch is `boundary_edges_shared_exactly`, which is 1.0 and has to stay there: below it,
two neighbours disagree about where their common boundary is and the regions no longer tile.

Same inputs, same outputs — there is nothing random in the pipeline, so a reviewer can
re-run it and diff.

`build_volumes.py` prints its own verification numbers too, and stores them in
`summary` / `validation` beside the meshes. The ones to watch are
`regions_partition_the_volume`, which asserts rather than reports — every voxel inside the
surface carries exactly one label — and `section_area_median_rel_error`, which says whether
the interpolation moved the plates it was built from. It should stay near the 1.4% the
0.05 mm lattice costs on its own.

Nothing from `build_volumes.py` goes into the app: 21 MB of meshes does not belong in a file
you open, and how they should get there is a decision to make against the geometry rather
than in advance. See [METHODS](../METHODS.md#the-third-dimension).

No build system and no CI. The app is still a file you open; these are documentation that
happens to run.
