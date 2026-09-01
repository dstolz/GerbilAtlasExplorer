# tools

The region extraction. Everything else in this repository is data with its derivation
written out in prose in [METHODS.md](../METHODS.md), which is enough when the derivation is
a fit with six numbers in it. This one is a segmentation cut out of a line drawing, and
prose alone would not let anyone check it.

| Script | What it does |
| --- | --- |
| `find_missing_labels.py` | Finds printed labels the label pass missed, by cutting the word from a plate that carries it and matching it back on one that does not. Extends `label_positions` and the app's `__BOX__`. Needs the source PDF. |
| `label_blocks.py` | Reads which abbreviations the atlas typeset into one printed label — `S1Tr/ LPtA`, `Au1 (A1)` — off the source PDF, and writes `label_blocks` into `data/gerbil_atlas.json`. Those name one region between them, so `build_region_extents.py` seeds them as one. |
| `build_region_extents.py` | Cuts `region_extents` out of the tracings in `svg/` and the located abbreviations in `label_positions`, and writes it into `data/gerbil_atlas.json`. |
| `regiongeom.py` | The boundary geometry: crack-lattice tracing, junction detection, arc-wise Douglas-Peucker. Kept apart because it is the part that has to be right for the regions to tile. |
| `inline_region_extents.py` | Copies `region_extents` from the JSON into the app as `window.__REGION__`, so the single file stays self-contained and the JSON stays the readable source. |

```
pip install numpy scipy scikit-image pillow pymupdf

python3 tools/find_missing_labels.py --pdf GerbilAtlas4Analysis.pdf   # extends label_positions
python3 tools/label_blocks.py --pdf GerbilAtlas4Analysis.pdf   # rewrites label_blocks
python3 tools/build_region_extents.py                  # all 62 plates, ~3 min, rewrites the JSON
python3 tools/build_region_extents.py --plates 30 --dry-run --qc
python3 tools/inline_region_extents.py                 # then re-inline into the app
python3 tools/inline_region_extents.py --check         # is the app's copy current
```

`label_blocks.py` and `find_missing_labels.py` need the published PDF, because it reads punctuation and the app's plate
images are too small to carry it — 8 px of glyph, against 20 on the page. It is the only
script here that reaches outside the repository, for the same reason the label pass did, and
its output is committed so that nothing downstream needs the PDF. `--qc` writes
`qc/chk_blocks_NN.png`, every join it made, boxed on the page it read.

`--dry-run` reports and touches nothing. `--qc` writes `qc/chk_regions_NN.png`, the plate
with its regions tinted by how much of each boundary the atlas actually prints.

The run prints the verification numbers as it goes and stores them in
`region_extents.summary`; `region_extents.validation` is the same numbers as prose. The one
to watch is `boundary_edges_shared_exactly`, which is 1.0 and has to stay there: below it,
two neighbours disagree about where their common boundary is and the regions no longer tile.

Same inputs, same outputs — there is nothing random in the pipeline, so a reviewer can
re-run it and diff.

No build system and no CI. The app is still a file you open; these are documentation that
happens to run.
