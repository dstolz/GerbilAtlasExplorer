# tools

The derivations that read something off the page rather than fitting a number to it.
Everything else in this repository is data with its derivation written out in prose in
[METHODS.md](../METHODS.md), which is enough when the derivation is a fit with six numbers
in it. These are not: a word matched back onto a plate that had lost it, a segmentation cut
out of a line drawing, a third axis invented between the plates. Prose alone would not let
anyone check any of them, so they are here as code, in the order they run.

| Script | What it does |
| --- | --- |
| `atlaslib.py` | What every script shares: the paths, the plate frame in millimeters, the page-to-plate transform, the traced-outline readers, one `--plates` grammar (`30`, `28-33`, `5,30,45`), and the renderer that writes `data/gerbil_atlas.json` byte for byte as the repository keeps it. A script loads the database, changes its block and saves; nothing splices text. |
| `build_app.py` | Builds `gerbil_atlas_explorer.html` and the lean `index.html` from `src/` and `data/`, stamps the commit, date and time into the page, and with `--check` exits non-zero when a committed page is not a fresh build. `--site DIR` writes everything GitHub Pages serves; `--dev` writes `build/dev.html`, which links `src/app.css` and `src/app.js` so code edits need no rebuild. |
| `export_tables.py` | The flat files, all from the JSON: the two CSVs that used to be kept by hand, a per-label coordinate table, a per-structure table with areas, volumes and centers, and GeoJSON extents per plate. `--refresh-db` also recomputes the counts the database carries — per plate, and the two totals in `verification` — and the `plate_registration` block; `--check` exits non-zero if any committed table is stale. |
| `build_groups.py` | The twenty gross divisions — cortex, hippocampal formation, thalamus, pons, brainstem and the rest — as named lists of the atlas's own abbreviations, written into the `groups` block. Declarative rules rather than a hand list, so the taxonomy can be read and argued with; `--report` prints every division with its members and the residue, `--check` exits non-zero if the committed block is stale. It adds no geometry: a division's outline, area, coordinate and mesh are all derived in the app from its members'. Stdlib only. |
| `check_indexes.py` | Reads the atlas's two published indexes against each other and against the database. No inputs beyond the repository. It is what says the 723 transcribed entries are intact, and it is where the seven malformed plate ranges are enumerated. It also writes the comparison out as `data/index_published.csv` (`--write`) and verifies the committed copy on every plain run. |
| `find_missing_labels.py` | Finds printed labels the label pass missed, by cutting the word from a plate that carries it and matching it back on one that does not. Extends `label_positions`. Needs the source PDF. |
| `find_unlettered.py` | Finds the printed labels no plate carries a located copy of, which is the case `find_missing_labels.py` structurally cannot reach: it cuts the word from a plate that has it, and these have none. Composes the word instead, letter by letter, from glyphs cut out of located labels on neighboring plates, then matches it the same way. Extends `label_positions`. Needs the source PDF. |
| `label_blocks.py` | Reads which abbreviations the atlas typeset into one printed label — `S1Tr/ LPtA`, `Au1 (A1)` — off the source PDF, and writes `label_blocks`. Those name one region between them, so `build_region_extents.py` seeds them as one. |
| `find_compounds.py` | The join `label_blocks.py` cannot see: a mark *inside* one token, joining two names neither of which is printed whole — `9a,bCb` is 9aCb and 9bCb, `9/11N` is 9N and 11N. Elides every pair the index lists on a plate with one of them unlocated, composes that token and matches it. Writes the token's box into `label_positions` for each member that has none of its own on it, and the pair into `label_blocks`. Needs the source PDF. |
| `label_leaders.py` | Follows the line the atlas draws from a label it could not fit inside the region it names, and writes where that line ends into `label_leaders`. For those 212 labels the box is where the word is; this is where the structure is, and it is what everything downstream seeds and aims at. Needs the source PDF. |
| `build_region_extents.py` | Cuts `region_extents` out of the tracings in `svg/` and the located abbreviations in `label_positions`, and writes it into `data/gerbil_atlas.json`. Also writes `features`, the twenty names the atlas prints that are no region — the fissures and sulci, `cbw`, the vessels — from `atlaslib.FEATURES`, because this is the script whose behavior that table is: they are seeded and then emptied, and the ground goes to the regions around them. |
| `build_region_colors.py` | The color every region wears, everywhere it is drawn: `region_colors`, one palette slot per abbreviation, solved once over all 62 plates at the same time because a color that holds across the atlas cannot be found one plate at a time. Reads `region_extents` and nothing else. `--report` prints the patches, the joins it had to refuse and the colors each plate carries; `--check` exits non-zero if the committed block is stale. The palette itself stays in the app; this knows only that there are eight slots. Stdlib only. |
| `regiongeom.py` | The boundary geometry: crack-lattice tracing, junction detection, arc-wise Douglas-Peucker, and the deburring that takes the pixel-wide slivers off the label map before any of it — a burr is nothing as area and a spike across the outline once simplified. Kept apart because it is the part that has to be right for the regions to tile. |
| `build_volumes.py` | Stacks the 62 plates, interpolates between them, and writes the brain surface and one mesh per structure to `data/gerbil_atlas_volumes.json`; `--stl DIR` writes the same meshes as STL, `--nifti PATH` the label volume they were cut from as a gzipped NIfTI-1 file with a lookup table beside it. |
| `volume.py` | The voxel geometry: the even-odd fill, the distance fields, marching cubes, hulls. Kept apart for the same reason `regiongeom.py` is — it holds the part that decides whether the regions still partition the volume. |
| `corrections.py` | A correction to how a region is drawn, read in from the plate view (`corrections/<id>.json`, written by `matlab/AtlasRegionFix.m`), against the extraction: `inspect` says where each seed lands today and in whose face, how far a drawn boundary's ends sit from traced ink, and which runs of a corrected extent lie off it, and draws all of it over the plate; `apply` writes boundaries into the plate's SVG as cubics the pipeline reads and seeds into `seed_overrides`. Then the pipeline, in the order below. |
| `inline_region_extents.py` | Retired; a shim that runs `build_app.py` (or its `--check`), so an old command still does the right thing. |

```
pip install -r tools/requirements.txt                   # pinned: see the note in the file

python3 tools/check_indexes.py                          # the two indexes against each other
python3 tools/check_indexes.py --write                  # rewrites data/index_published.csv
python3 tools/find_missing_labels.py --pdf GerbilAtlas4Analysis.pdf   # extends label_positions
python3 tools/find_unlettered.py --pdf GerbilAtlas4Analysis.pdf --sheet /tmp/s.png  # then read it
python3 tools/find_compounds.py --pdf GerbilAtlas4Analysis.pdf --sheet /tmp/c.png   # then read it
python3 tools/label_blocks.py --pdf GerbilAtlas4Analysis.pdf   # rewrites label_blocks
python3 tools/label_leaders.py --pdf GerbilAtlas4Analysis.pdf  # rewrites label_leaders
python3 tools/corrections.py inspect corrections/ID.json --qc   # a correction against the extraction
python3 tools/corrections.py apply corrections/ID.json          # into svg/ and seed_overrides; then the pipeline
python3 tools/build_region_extents.py                  # all 62 plates, ~5 min, rewrites the JSON
python3 tools/build_region_extents.py --plates 30 --dry-run --qc
python3 tools/build_volumes.py                         # all 62 plates, ~3 min, 21 MB of meshes
python3 tools/build_volumes.py --plates 28-33 --dry-run --qc
python3 tools/build_volumes.py --stl out/              # the same meshes as STL
python3 tools/build_volumes.py --nifti data/gerbil_atlas_labels.nii.gz   # the label volume as NIfTI
python3 tools/build_groups.py --report                 # the divisions and their members
python3 tools/build_groups.py                          # writes the `groups` block
python3 tools/build_region_colors.py                   # writes the `region_colors` block
python3 tools/build_region_colors.py --report          # the patches, the refusals, the plates
python3 tools/export_tables.py --refresh-db            # the CSVs, the tables, the GeoJSON
python3 tools/build_app.py --lean                      # then rebuild both pages
python3 tools/build_app.py --check                     # are the committed pages a fresh build
python3 tools/export_tables.py --check                 # are the committed tables current
python3 tools/build_groups.py --check                  # are the committed divisions current
python3 tools/build_region_colors.py --check           # is the committed coloring current
python3 -m pytest tests/python                         # the data's own promises, as tests
```

Every script that works plate by plate takes `--plates` the same way — `30`, `28-33`,
`5,30,45`, or a mix (`label_blocks.py`, `find_missing_labels.py` and `find_unlettered.py`
run over all 62) — and every block keyed by plate is written whole: a run over some
plates reports and refuses to write, because writing what it read would drop the other
plates. `--dry-run` reports and touches nothing. `$GERBIL_ATLAS_PDF` can name the PDF in
place of `--pdf`.

`label_blocks.py`, `find_missing_labels.py` and `label_leaders.py` need the published PDF,
because they read the page itself — punctuation for the first, the shape of a whole word for
the second, a one-pixel line for the third — and the app's plate images are too small to
carry any of it: 8 px of glyph against 20 on the page, and a leader that survives the
downsample as gray rather than ink. They are the only scripts here that reach outside the
repository, for the same reason the label pass did, and their output is committed so that
nothing downstream needs the PDF. `label_blocks.py --qc` writes `qc/chk_blocks_NN.png`,
every join it made, boxed on the page it read; `label_leaders.py --qc` writes
`qc/chk_leader_NN.png`, every line it followed, drawn from the box to the point it lands on.
Both carry a `REJECT` table of candidates that were read against the printed plate and
turned out to be something else, so a re-run reproduces the committed block rather than
quietly making the same mistakes again.

A correction is one more input the pipeline reads: `seed_overrides` in the database, a seed
a reader placed by hand, standing in for a printed box or beside the printed ones; and
the paths `corrections.py apply` adds to a plate's SVG, marked `data-correction` with the
file they came from. Both survive every re-run, which is the difference from editing the
derived blocks: `build_region_extents.py` reads them and cuts the extents afresh.

`--dry-run` reports and touches nothing. `--qc` writes `qc/chk_regions_NN.png`, the plate
with its regions tinted by how much of each boundary the atlas actually prints; from
`build_volumes.py` it writes `qc/chk_vol_NN.png`, a plate beside the plane interpolated
halfway to the next one, which is the check that catches an interpolation nobody would
believe.

The run prints the verification numbers as it goes and stores them in
`region_extents.summary`; `region_extents.validation` is the same numbers as prose. The one
to watch is `boundary_edges_shared_exactly`, which is 1.0 and has to stay there: below it,
two neighbors disagree about where their common boundary is and the regions no longer tile.

Same inputs, same outputs — there is nothing random in the pipeline, so a reviewer can
re-run it and diff.

`build_volumes.py` prints its own verification numbers too, and stores them beside the
meshes: `summary`, `checks` as figures, and `validation` as prose. The ones to watch are
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
traced outlines and their registration (`data/vec.json` — the paths as the vectorizer
produced them, and the six-number matrix fitted per plate; the matrices are copied into
`plate_registration` in the JSON, and a test keeps the two equal), the skull
(`data/skull.json`), and `brain_outline`, which the app's own `v3build()` produced.

`requirements.txt` pins the versions the committed data was regenerated with, which need
Python 3.11 or newer. On those,
`build_region_extents.py` reproduces `region_extents` byte for byte; the meshes come
back with the same vertices and a different triangle order under a different
scikit-image, which is why the pins are `==`.

GitHub Actions runs `check_indexes.py`, `export_tables.py --check`, `build_groups.py
--check`, `build_region_colors.py --check`, `build_app.py --check`, the Python tests and the
browser tests on every push
(`.github/workflows/ci.yml`);
`pages.yml` builds the site for GitHub Pages and attaches the bundle to a release on a
version tag.
