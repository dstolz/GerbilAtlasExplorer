# tools

The derivations that read something off the page rather than fitting a number to it.
Everything else in this repository is data with its derivation written out in prose in
[METHODS.md](../METHODS.md), which is enough when the derivation is a fit with six numbers
in it. These are not: a word matched back onto a plate that had lost it, a segmentation cut
out of a line drawing, a third axis invented between the plates. Prose alone would not let
anyone check any of them, so they are here as code, in the order they run.

| Script | What it does |
| --- | --- |
| `atlaslib.py` | What every script shares: the paths, the plate frame in millimetres, the page-to-plate transform, the traced-outline readers, one `--plates` grammar (`30`, `28-33`, `5,30,45`), and the renderer that writes `data/gerbil_atlas.json` byte for byte as the repository keeps it. A script loads the database, changes its block and saves; nothing splices text. |
| `build_app.py` | Builds `gerbil_atlas_explorer.html` and the lean `index.html` from `src/` and `data/`, stamps the commit, date and time into the page, and with `--check` exits non-zero when a committed page is not a fresh build. `--site DIR` writes everything GitHub Pages serves; `--dev` writes `build/dev.html`, which links `src/app.css` and `src/app.js` so code edits need no rebuild. |
| `export_tables.py` | The flat files, all from the JSON: the two CSVs that used to be kept by hand, a per-label coordinate table, a per-structure table with areas, volumes and centres, and GeoJSON extents per plate. `--refresh-db` also recomputes the per-plate counts the database carries and the `plate_registration` block; `--check` exits non-zero if any committed table is stale. |
| `build_groups.py` | The twenty gross divisions — cortex, hippocampal formation, thalamus, pons, brainstem and the rest — as named lists of the atlas's own abbreviations, written into the `groups` block. Declarative rules rather than a hand list, so the taxonomy can be read and argued with; `--report` prints every division with its members and the residue, `--check` exits non-zero if the committed block is stale. It adds no geometry: a division's outline, area, coordinate and mesh are all derived in the app from its members'. Stdlib only. |
| `check_indexes.py` | Reads the atlas's two published indexes against each other and against the database. No inputs beyond the repository. It is what says the 723 transcribed entries are intact, and it is where the seven malformed plate ranges are enumerated. |
| `find_missing_labels.py` | Finds printed labels the label pass missed, by cutting the word from a plate that carries it and matching it back on one that does not. Extends `label_positions`. Needs the source PDF. |
| `label_blocks.py` | Reads which abbreviations the atlas typeset into one printed label — `S1Tr/ LPtA`, `Au1 (A1)` — off the source PDF, and writes `label_blocks`. Those name one region between them, so `build_region_extents.py` seeds them as one. |
| `label_leaders.py` | Follows the line the atlas draws from a label it could not fit inside the region it names, and writes where that line ends into `label_leaders`. For those 215 labels the box is where the word is; this is where the structure is, and it is what everything downstream seeds and aims at. Needs the source PDF. |
| `build_region_extents.py` | Cuts `region_extents` out of the tracings in `svg/` and the located abbreviations in `label_positions`, and writes it into `data/gerbil_atlas.json`. |
| `regiongeom.py` | The boundary geometry: crack-lattice tracing, junction detection, arc-wise Douglas-Peucker. Kept apart because it is the part that has to be right for the regions to tile. |
| `build_volumes.py` | Stacks the 62 plates, interpolates between them, and writes the brain surface and one mesh per structure to `data/gerbil_atlas_volumes.json`; `--stl DIR` writes the same meshes as STL, `--nifti PATH` the label volume they were cut from as a gzipped NIfTI-1 file with a lookup table beside it. |
| `volume.py` | The voxel geometry: the even-odd fill, the distance fields, marching cubes, hulls. Kept apart for the same reason `regiongeom.py` is — it holds the part that decides whether the regions still partition the volume. |
| `inline_region_extents.py` | Retired; a shim that runs `build_app.py` (or its `--check`), so an old command still does the right thing. |

```
pip install -r tools/requirements.txt                   # pinned: see the note in the file

python3 tools/check_indexes.py                          # the two indexes against each other
python3 tools/find_missing_labels.py --pdf GerbilAtlas4Analysis.pdf   # extends label_positions
python3 tools/label_blocks.py --pdf GerbilAtlas4Analysis.pdf   # rewrites label_blocks
python3 tools/label_leaders.py --pdf GerbilAtlas4Analysis.pdf  # rewrites label_leaders
python3 tools/build_region_extents.py                  # all 62 plates, ~3 min, rewrites the JSON
python3 tools/build_region_extents.py --plates 30 --dry-run --qc
python3 tools/build_volumes.py                         # all 62 plates, ~3 min, 21 MB of meshes
python3 tools/build_volumes.py --plates 28-33 --dry-run --qc
python3 tools/build_volumes.py --stl out/              # the same meshes as STL
python3 tools/build_volumes.py --nifti data/gerbil_atlas_labels.nii.gz   # the label volume as NIfTI
python3 tools/build_groups.py --report                 # the divisions and their members
python3 tools/build_groups.py                          # writes the `groups` block
python3 tools/export_tables.py --refresh-db            # the CSVs, the tables, the GeoJSON
python3 tools/build_app.py --lean                      # then rebuild both pages
python3 tools/build_app.py --check                     # are the committed pages a fresh build
python3 tools/export_tables.py --check                 # are the committed tables current
python3 tools/build_groups.py --check                  # are the committed divisions current
python3 -m pytest tests/python                         # the data's own promises, as tests
```

Every script takes `--plates` the same way — `30`, `28-33`, `5,30,45`, or a mix — and
every block keyed by plate is written whole: a run over some plates reports and refuses
to write, because writing what it read would drop the other plates. `--dry-run` reports
and touches nothing. `$GERBIL_ATLAS_PDF` can name the PDF in place of `--pdf`.

`label_blocks.py`, `find_missing_labels.py` and `label_leaders.py` need the published PDF,
because they read the page itself — punctuation for the first, the shape of a whole word for
the second, a one-pixel line for the third — and the app's plate images are too small to
carry any of it: 8 px of glyph against 20 on the page, and a leader that survives the
downsample as grey rather than ink. They are the only scripts here that reach outside the
repository, for the same reason the label pass did, and their output is committed so that
nothing downstream needs the PDF. `label_blocks.py --qc` writes `qc/chk_blocks_NN.png`,
every join it made, boxed on the page it read; `label_leaders.py --qc` writes
`qc/chk_leader_NN.png`, every line it followed, drawn from the box to the point it lands on.
Both carry a `REJECT` table of candidates that were read against the printed plate and
turned out to be something else, so a re-run reproduces the committed block rather than
quietly making the same mistakes again.

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

Everything the app is built from is under `src/` and `data/`, and `tools/build_app.py`
puts it together; no script reads or writes the HTML. Four things in `data/` have no
generator in the repository and are committed as they are: the plate images
(`data/plates/`, cropped by the pass METHODS describes under "Plate images"), the
traced outlines and their registration (`data/vec.json` — the paths as the vectoriser
produced them, and the six-number matrix fitted per plate; the matrices are copied into
`plate_registration` in the JSON, and a test keeps the two equal), the skull
(`data/skull.json`), and `brain_outline`, which the app's own `v3build()` produced.

`requirements.txt` pins the versions the committed data was regenerated with, which need
Python 3.11 or newer. On those,
`build_region_extents.py` reproduces `region_extents` byte for byte; the meshes come
back with the same vertices and a different triangle order under a different
scikit-image, which is why the pins are `==`.

GitHub Actions runs `check_indexes.py`, `export_tables.py --check`, `build_app.py
--check`, the Python tests and the browser tests on every push (`.github/workflows/ci.yml`);
`pages.yml` builds the site for GitHub Pages and attaches the bundle to a release on a
version tag.
