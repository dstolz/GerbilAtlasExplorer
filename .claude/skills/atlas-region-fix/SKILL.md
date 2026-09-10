---
name: atlas-region-fix
description: Take a correction to how a region of the gerbil atlas is drawn -- a corrections/<id>.json written by fixer.html, tools/atlasfix.py or matlab/AtlasRegionFix.m, or a report that a region on a plate has the wrong outline, the wrong area or no area -- to a pushed fix and a write-up ready to be a pull request. Diagnoses which pipeline input is at fault (the tracing, the section outline, a seed, a label box), fixes that input and nothing downstream by hand, rebuilds the extents and everything cut from them with tools/pipeline.py, runs every check, reads the numbers off tools/corrections.py report, and writes it up in the repository's voice. Use when a correction/* branch carries a corrections file, when asked to fix, correct or redraw a region, extent, outline or seed on a plate, or when a structure has no area on a plate where the atlas prints it.
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
- the **section outline**, `brain_outline`, which the faces are cut inside of -- itself cut by
  `tools/build_brain_outline.py` from the plate image and the tracing: the drawn line wherever
  the atlas draws one along the edge, the tissue edge where it does not.

So a wrong region is one of those inputs being wrong, and the fix is to the input. The
polygon, the geojson, the tables, the meshes, the label volume and the pages are all
rebuilt from it. Never edit any of those by hand, and never loosen a constant in
`build_region_extents.py` to make one plate come out: `boundary_edges_shared_exactly` must
stay 1.0, which it does by construction as long as the extents are re-cut.

What is an input and what is derived is written down once, in `atlaslib.INPUT_BLOCKS`,
`DERIVED_BLOCKS` and `DERIVED_PATHS`; `corrections.py rebase` and the workflows read it
from there.

## The four causes, and how each shows

Every fix so far was one of these (PRs #77, #78, #79, #109, #110; `git log --grep` for
the details):

| Cause | The tell | The fix |
| --- | --- | --- |
| **A run of tracing is missing.** Two faces the atlas separates are one face, so one name gets both, or `BRIDGE_PX` welds a dangling end sideways and walls a strip off from its label (S1DZ, plate 19). | `inspect` puts the seed in an unnamed face or a neighbour's face; the boundary's ends sit on ink; the region is a scrap on one side and a band on the other. | Add the run to the SVG. `corrections.py apply` writes a boundary from the file as a `<path>` of cubics in the group its style names, with `data-correction="<id>"`. By hand: the same, as `M x y C ...` -- never `L`, which `build_region_extents.flatten` does not read. |
| **An island was culled from the outline.** `brain_outline` keeps a component only if it is over max(400 px, 2% of the largest) or carries a printed label; a structure drawn clear of the section with no label located inside it is dropped, and a face outside the outline can never be named. | The region has no area on the plate; its label sits outside every outline ring; the drawing shows the structure standing free. | The outline is derived: do not edit it. Locate the label (the fourth cause) or fix the tracing that should seal the island, then `build_brain_outline.py` keeps it by rule. `test_brain_outline` counts rings (84): move it to what the tool prints, and say so in the CHANGELOG. |
| **A seed lands in the wrong face.** The label is printed outside its region and its line was misread, or the word sits on a boundary and `SNAP_PX` pulled it into the neighbour (OV, plate 5); or the printed box is right and the drawing cuts the region into more faces than the plate letters it times (RAPir, plate 28; E, plate 3). | `inspect` puts the region's own box in a face lettered by another name, while the seed from the correction lands in a face nobody letters. | A row of `seed_overrides`: `apply` writes one standing in for box `i` from a seed whose entry carries `label_index`; for a seed without it, the row is a seed of its own beside the box (right when the box is fine and a face is simply unlettered). Where the leader pass itself read the line wrongly, `TIP_READ` in `tools/label_leaders.py` is the idiom, but it only takes effect on a re-run against the PDF. |
| **A label was never read.** The word is printed but no box was located, so nothing seeds the face (layer 1, plates 17-18). | The plate prints the name; `label_positions.data[plate]` has no entry; the face is unassigned or held by a neighbour. | Add the box `[cx, cy, w, h]` (plate-frame fractions, 4 decimals) to `label_positions.data[plate][abbr]`. `test_label_positions` counts labels and (plate, name) pairs and `plates[].n_labels_located` is refreshed by the `tables` step: bump the literals, and say so. |

A drawn **extent** in a correction is evidence, not an input: `apply` traces only the runs
of it that lie more than 3 px off the ink already traced, and the extents are re-cut. If
the drawing has a line the atlas does not (the tracer's stray), take that `<path>` out by
hand and say which and why in the commit.

A file with a **`preview`** block was sent after the reader ran **Recut** in
`tools/atlasfix.py`: it says what area the reader saw the fix give and accepted. `report`
compares the re-cut to it. Agreement is confirmation that the fix applied is the one the
reader previewed; disagreement means an input changed under the marks, or the fix taken is
not the one previewed, and the write-up says which.

## Procedure

Under `.github/workflows/apply-correction.yml`, steps 1 and 2 have been done before the
session starts: the branch is current with main, `inspect --qc` has run and its output is
in the prompt, and its pictures are under `qc/`. By hand, do them.

1. **Set up.** `pip install -r tools/requirements.txt` (the pins reproduce the committed
   data byte for byte; Python 3.11+). Then `python3 tools/corrections.py rebase --onto
   origin/main`: the derived files must be rebuilt on the inputs they will be committed
   with, and this merges main taking main's derived files, lays the branch's inputs on
   them, and re-cuts only where the branch has already changed an input. On a branch that
   carries nothing but the correction it is a plain merge.
2. **Read the correction.** `python3 tools/corrections.py inspect corrections/<id>.json --qc`
   and look at `qc/chk_corr_<id>.png` (red tracing, green the region today, yellow its
   boxes, blue seeds, cyan boundaries, magenta extents) and `qc/chk_corr_<id>_site.png`,
   the site cropped, the region on `origin/main` beside the region here. Read the plate
   drawing (`data/plates/drawing/NN.jpg`) around the site. Decide the cause from the table
   above.
3. **Fix the input.** `python3 tools/corrections.py apply corrections/<id>.json` for
   boundaries and seeds (`--dry-run` first shows what it would write); islands and boxes by
   hand, through `atlaslib.load_db` / `save_db` so the file keeps its byte-exact layout.
   Do not edit the correction file itself: the workflow's loop guard is that a fix commit
   never touches `corrections/`.
4. **Confirm on the one plate.** `python3 tools/pipeline.py rebuild --plates NN` (which is
   `build_region_extents.py --plates NN --dry-run --qc`), then `inspect` again: the seed
   now lands in its region, the area is what its mirror measures, nothing else on the
   plate lost ground.
5. **Rebuild.** `python3 tools/pipeline.py rebuild` -- the six steps in the order each
   reads what the one before wrote, about ten minutes. `pipeline.py steps` lists them.
   The `tables` step also rewrites the totals METHODS.md states between `<!-- n:... -->`
   markers, so those are never edited by hand.
6. **Check, and read the numbers.** `python3 tools/pipeline.py check` -- every `--check`
   and the Python tests; the browser tests run in CI on the push. Then
   `python3 tools/corrections.py report corrections/<id>.json` (against `origin/main`):
   the region before and after, per hemisphere and over the series; every other
   (plate, region) entry that moved, on this plate and elsewhere; the volumes that moved;
   the summaries side by side; the inputs the branch changes. Read it: the named region
   gains, entries on the same plate move by their share of a wall, an entry on another
   plate wants a reason, and `boundary_edges_shared_exactly` is 1.0.
7. **Write it up**, in the repository's voice (read the last three entries of
   `CHANGELOG.md` first). Two things:
   - `CHANGELOG.md`, under `## [Unreleased]` / `### Fixed`: a bold lead sentence naming the
     region and plate, then the cause, then what moved with numbers from the report --
     area before and after, meshes changed, what else moved and why -- and that
     `boundary_edges_shared_exactly` stays 1.0. Name the correction id. `METHODS.md` only
     where a stated rule changed, never a total. The block notes (`seed_overrides.note`,
     `brain_outline.note`) are static and enumerate nothing: a row's reason is in the row.
   - `build/pr.md`, which the workflow opens the pull request from: the first line is the
     title, a sentence about the region (`The optic chiasm gets its plate back`); then a
     blank line; then the body, which **opens with the site picture** so the region before
     and after is the first thing a reader sees, then the cause, the fix, the reading taken
     and the one not taken with what would tell them apart, and the report's tables:
     ```
     ![<abbr> on plate NN, before and after](https://raw.githubusercontent.com/<owner>/<repo>/{{SHA}}/qc/chk_corr_<id>_site.png)
     ```
     `{{SHA}}` is written literally; the workflow puts the pushed commit there, which is
     what pins the picture to the pull request after the branch is gone. End the body with
     `Co-authored-by: Daniel <dstolz@umd.edu>`.
8. **Commit and push** to the same `correction/<id>` branch. The title is the first line
   of `build/pr.md`; the body says the cause and the numbers; end with
   `Co-authored-by: Daniel <dstolz@umd.edu>`. Commit `qc/chk_corr_<id>.png` and
   `qc/chk_corr_<id>_site.png` with the fix, both from an `inspect --qc` run after the
   rebuild: the correction file is what the reader drew, and those pictures are what it
   did. Then open the pull request from `build/pr.md`, under the workflow and by hand
   alike:
   ```
   gh pr create --base main --title "$(head -n 1 build/pr.md)" \
     --body "$(tail -n +2 build/pr.md | sed "s/{{SHA}}/$(git rev-parse HEAD)/g")"
   ```
   Under the workflow the token you hold is the App's, which may open one where the
   workflow's own may not; leave `build/pr.md` in place, since the workflow finds the
   pull request you opened and waits on its checks, and opens one from the file itself
   where you could not. Do not merge, and do not wait to be told to: a person reads it
   before it lands. If main
   moves while it waits, `rebase-corrections.yml` brings the branch up and re-cuts it
   without a session; the pull request's numbers stay right because they came from
   `report` on the same inputs.

## Never

- Never hand-edit `region_extents`, `data/geojson/*`, the CSVs, the meshes, the NIfTI or
  the pages: rebuild them.
- Never change `BRIDGE_PX`, `MIN_FACE_PX`, `SNAP_PX`, `DP_PX` or their kin for one plate.
- Never write `L` into an SVG path the pipeline reads; never nest a `<g>`.
- Never touch `corrections/*.json` on the branch; never bump the pinned versions; never
  reconcile a test literal without saying in the CHANGELOG what moved it.
- Never edit `tools/`, `src/`, `tests/` or the workflows in a correction run. A correction
  changes pipeline inputs, the docs and `qc/`. If a tool is wrong, say so in the write-up;
  a fix to it is its own pull request, made once, not once per correction in flight.
- Never merge another correction branch into this one, and never merge main by hand:
  `corrections.py rebase` is the merge. A branch stacked on another conflicts with main the
  moment the other lands as a squash.
