# tools

The derivations that read something off the page rather than fitting a number to it.
Everything else in this repository is data with its derivation written out in prose in
[METHODS.md](../METHODS.md), which is enough when the derivation is a fit with six numbers
in it. These are not: a word matched back onto a plate that had lost it, a segmentation cut
out of a line drawing, a third axis invented between the plates. Prose alone would not let
anyone check any of them, so they are here as code, in the order they run.

| Script | What it does |
| --- | --- |
| `check_indexes.py` | Reads the atlas's two published indexes against each other and against the database. No inputs beyond the repository. It is what says the 723 transcribed entries are intact, and it is where the seven malformed plate ranges are enumerated. |
| `find_missing_labels.py` | Finds printed labels the label pass missed, by cutting the word from a plate that carries it and matching it back on one that does not. Extends `label_positions` and the app's `__BOX__`. Needs the source PDF. |
| `label_blocks.py` | Reads which abbreviations the atlas typeset into one printed label — `S1Tr/ LPtA`, `Au1 (A1)` — off the source PDF, and writes `label_blocks` into `data/gerbil_atlas.json`. Those name one region between them, so `build_region_extents.py` seeds them as one. |
| `build_region_extents.py` | Cuts `region_extents` out of the tracings in `svg/` and the located abbreviations in `label_positions`, and writes it into `data/gerbil_atlas.json`. |
| `regiongeom.py` | The boundary geometry: crack-lattice tracing, junction detection, arc-wise Douglas-Peucker. Kept apart because it is the part that has to be right for the regions to tile. |
| `inline_region_extents.py` | Copies `region_extents` from the JSON into the app as `window.__REGION__`, so the single file stays self-contained and the JSON stays the readable source. |
| `build_volumes.py` | Stacks the 62 plates, interpolates between them, and writes the brain surface and one mesh per structure to `data/gerbil_atlas_volumes.json`. |
| `volume.py` | The voxel geometry: the even-odd fill, the distance fields, marching cubes, hulls. Kept apart for the same reason `regiongeom.py` is — it holds the part that decides whether the regions still partition the volume. |

```
pip install numpy scipy scikit-image pillow pymupdf

python3 tools/check_indexes.py                          # the two indexes against each other
python3 tools/find_missing_labels.py --pdf GerbilAtlas4Analysis.pdf   # extends label_positions
python3 tools/label_blocks.py --pdf GerbilAtlas4Analysis.pdf   # rewrites label_blocks
python3 tools/build_region_extents.py                  # all 62 plates, ~3 min, rewrites the JSON
python3 tools/build_region_extents.py --plates 30 --dry-run --qc
python3 tools/inline_region_extents.py                 # then re-inline into the app
python3 tools/inline_region_extents.py --check         # is the app's copy current

python3 tools/build_volumes.py                         # all 62 plates, ~3 min, 21 MB of meshes
python3 tools/build_volumes.py --plates 28-33 --dry-run --qc
python3 tools/build_volumes.py --samples 6             # coarser meshes, a quarter the size
python3 tools/build_volumes.py --stl out/              # the same meshes as STL
```

`label_blocks.py` and `find_missing_labels.py` need the published PDF, because they read the
page itself — punctuation for the one, the shape of a whole word for the other — and the
app's plate images are too small to carry either: 8 px of glyph, against 20 on the page.
They are the only scripts here that reach outside the repository, for the same reason the
label pass did, and their output is committed so that nothing downstream needs the PDF.
`label_blocks.py --qc` writes `qc/chk_blocks_NN.png`, every join it made, boxed on the page
it read.

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
