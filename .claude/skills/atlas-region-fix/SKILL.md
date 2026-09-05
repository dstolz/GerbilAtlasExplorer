---
name: atlas-region-fix
description: Take a correction to how a region of the gerbil atlas is drawn -- a corrections/<id>.json written by tools/atlasfix.py or matlab/AtlasRegionFix.m, or a report that a region on a plate has the wrong outline, the wrong area or no area -- to a finished pull request. Diagnoses which pipeline input is at fault (the tracing, the section outline, a seed, a label box), fixes that input and nothing downstream by hand, rebuilds the extents and everything cut from them, runs every check, and writes it up in the repository's voice. Use when a correction/* branch carries a corrections file, when asked to fix, correct or redraw a region, extent, outline or seed on a plate, or when a structure has no area on a plate where the atlas prints it.
---

# Fixing how a region is drawn

## What a region is here

Nothing in `region_extents` is drawn by hand. `tools/build_region_extents.py` cuts every
region out of three inputs:

- the **tracing** of the printed drawing, `svg/GerbilAtlas_Plate_NN.svg` (page frame,
  3296 x 2481 px; plate 20 is 2481 x 3296), whose lines are rasterized, bridged across
  gaps under `BRIDGE_PX` = 20 px, and cut into faces;
- the **seeds**: the printed label boxes in `label_positions`, the ends of leader lines in
  `label_leaders`, and any row of `seed_overrides` -- a face sealed by ink and seeded by one
  name is that name's area; a face several names share is split by a watershed;
- the **section outline**, `brain_outline`, which the faces are cut inside of.

So a wrong region is one of those inputs being wrong, and the fix is to the input. The
polygon, the geojson, the tables, the meshes, the label volume and the two pages are all
rebuilt from it. Never edit any of those by hand, and never loosen a constant in
`build_region_extents.py` to make one plate come out: `boundary_edges_shared_exactly` must
stay 1.0, which it does by construction as long as the extents are re-cut.

## The four causes, and how each shows

Every fix so far was one of these (PRs #77, #78, #79; `git log --grep` for the details):

| Cause | The tell | The fix |
| --- | --- | --- |
| **A run of tracing is missing.** Two faces the atlas separates are one face, so one name gets both, or `BRIDGE_PX` welds a dangling end sideways and walls a strip off from its label (S1DZ, plate 19). | `inspect` puts the seed in an unnamed face or a neighbour's face; the boundary's ends sit on ink; the region is a scrap on one side and a band on the other. | Add the run to the SVG. `corrections.py apply` writes a boundary from the file as a `<path>` of cubics in the group its style names, with `data-correction="<id>"`. By hand: the same, as `M x y C ...` -- never `L`, which `build_region_extents.flatten` does not read. |
| **An island was culled from the outline.** `brain_outline` keeps a component only if it is over max(400 px, 2% of the largest); a structure drawn clear of the section (och on 22, ML on 36) is dropped, and a face outside the outline can never be named. | The region has no area on the plate; its label sits outside every outline ring; the drawing shows the structure standing free. | Trace the island by the steps `brain_outline.derivation` gives and append it as a second polygon of `brain_outline.data[plate]` (fractions, 5 decimals). `test_brain_outline` counts rings (83): bump it, and say so in the CHANGELOG. |
| **A seed lands in the wrong face.** The label is printed outside its region and its line was misread, or the word sits on a boundary and `SNAP_PX` pulled it into the neighbour (OV, plate 5). | `inspect` puts the region's own box in a face lettered by another name, while the seed from the correction lands in a face nobody letters. | A row of `seed_overrides` standing in for that box: `apply` writes one from a seed whose entry carries `label_index`; for a seed without it, the row is a seed of its own beside the box (right when the box is fine and a face is simply unlettered). Where the leader pass itself read the line wrongly, `TIP_READ` in `tools/label_leaders.py` is the idiom, but it only takes effect on a re-run against the PDF. |
| **A label was never read.** The word is printed but no box was located, so nothing seeds the face (layer 1, plates 17-18). | The plate prints the name; `label_positions.data[plate]` has no entry; the face is unassigned or held by a neighbour. | Add the box `[cx, cy, w, h]` (plate-frame fractions, 4 decimals) to `label_positions.data[plate][abbr]`. `test_label_positions` counts 6322 labels and 3339 (plate, name) pairs and `plates[].n_labels_located` is refreshed by `export_tables.py --refresh-db`: bump the literals, and say so. |

A drawn **extent** in a correction is evidence, not an input: `apply` traces only the runs
of it that lie more than 3 px off the ink already traced, and the extents are re-cut. If
the drawing has a line the atlas does not (the tracer's stray), take that `<path>` out by
hand and say which and why in the commit.

## Procedure

1. **Set up.** `pip install -r tools/requirements.txt` (the pins reproduce the committed
   data byte for byte; Python 3.11+). For the browser tests, `npm ci && npx playwright
   install --with-deps chromium`. If `origin/main` has moved past the branch, merge it in
   first (`git merge --no-edit origin/main`): the derived blocks must be rebuilt on the
   inputs they will be committed with.
2. **Read the correction.** `python3 tools/corrections.py inspect corrections/<id>.json --qc`
   and look at `qc/chk_corr_<id>.png` (red tracing, green the region today, yellow its
   boxes, blue seeds, cyan boundaries, magenta extents). Read the plate drawing
   (`data/plates/drawing/NN.jpg`) around the site. Decide the cause from the table above.
3. **Fix the input.** `python3 tools/corrections.py apply corrections/<id>.json` for
   boundaries and seeds (`--dry-run` first shows what it would write); islands and boxes by
   hand, through `atlaslib.load_db` / `save_db` so the file keeps its byte-exact layout.
   Do not edit the correction file itself: the workflow's loop guard is that a fix commit
   never touches `corrections/`.
4. **Confirm on the one plate.** `python3 tools/build_region_extents.py --plates NN
   --dry-run --qc`, then `inspect` again: the seed now lands in its region, the area is
   what its mirror measures, nothing else on the plate lost ground. A run over some plates
   refuses to write, by design.
5. **Rebuild, in order.** Each reads what the one before wrote:
   ```
   python3 tools/build_region_extents.py                                  # ~5 min
   python3 tools/build_volumes.py --nifti data/gerbil_atlas_labels.nii.gz # ~3 min
   python3 tools/build_region_colors.py
   python3 tools/export_tables.py --refresh-db
   python3 tools/build_app.py --lean
   python3 tools/build_app.py
   ```
6. **Check everything.** `python3 tools/check_indexes.py`, `export_tables.py --check`,
   `build_groups.py --check`, `build_region_colors.py --check`, `build_app.py --check`,
   `python -m pytest tests/python -q`, `npx playwright test`. Read the numbers the run
   printed: `boundary_edges_shared_exactly` 1.0, the structure count (688 unless a region
   gained its first mesh), and the per-(plate, abbr) diff of `region_extents` against
   `origin/main` -- the named region gains; anything else that moves must be explained.
7. **Write it up**, in the repository's voice (read the last three entries of
   `CHANGELOG.md` and the `Region extents` section of `METHODS.md` first). `CHANGELOG.md`,
   under `## [Unreleased]` / `### Fixed`: a bold lead sentence naming the region and plate,
   then the cause, then what moved with numbers -- area before and after, meshes changed,
   what else moved and why -- and that `boundary_edges_shared_exactly` stays 1.0. Name the
   correction id. `METHODS.md` wherever a stated number or rule changed (ring counts,
   label counts, the totals under Region extents). The block notes in the database
   (`brain_outline.note`, `seed_overrides.note`) where they enumerate cases.
8. **Commit and push** to the same `correction/<id>` branch. The title is a sentence about
   the region (`The optic chiasm gets its plate back`); the body says the cause and the
   numbers; end with `Co-authored-by: Daniel <dstolz@umd.edu>`. Then open the pull request
   against `main` with `gh pr create`, the write-up as its body. Do not merge: the workflow
   merges once CI is green.

## Never

- Never hand-edit `region_extents`, `data/geojson/*`, the CSVs, the meshes, the NIfTI or
  the pages: rebuild them.
- Never change `BRIDGE_PX`, `MIN_FACE_PX`, `SNAP_PX`, `DP_PX` or their kin for one plate.
- Never write `L` into an SVG path the pipeline reads; never nest a `<g>`.
- Never touch `corrections/*.json` on the branch; never bump the pinned versions; never
  reconcile a test literal without saying in the CHANGELOG what moved it.
