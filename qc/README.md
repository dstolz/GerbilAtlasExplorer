# qc

Verification renders kept from the build. Not used by the app. Each file is either
written by a script in `tools/` (re-run it with `--qc` to regenerate) or a one-off
from a derivation that lives in prose only (METHODS.md), kept for the record.

| Files | Written by | What to look for |
| --- | --- | --- |
| `chk_regions_NN.png` (5 plates: 05, 20, 30, 45, 56) | `tools/build_region_extents.py --qc` | the region extents on the plate, tinted green where the boundary is drawn and red where it was inferred; a leak between two regions shows here when the medians average it away |
| `chk_vol_NN.png` (the same 5 plates), `chk_vol_regions.png`, `chk_vol_surface.png` | `tools/build_volumes.py --qc` | a plate, the plane interpolated halfway to the next, and that next plate, side by side; and depth-shaded views of the whole surface and the label volume |
| `chk_corr_<id>.png` | `tools/corrections.py inspect --qc` | a correction over its plate: red tracing, green the region as it stands, yellow its printed boxes, blue seeds (a negative one crossed), cyan boundaries, magenta extents; the first thing read before a correction is applied. Not committed |
| `chk_leader_NN.png` (05, 30, 44, 54) | `tools/label_leaders.py --qc` (needs the PDF) | every leader line followed, drawn from the box to the point it lands on |
| `chk_blocks_NN.png` | `tools/label_blocks.py --qc` (needs the PDF) | every join read off the page, boxed; not currently committed |
| `chk_found_NN.png` | `tools/find_missing_labels.py --qc` (needs the PDF) | every word the third pass found, boxed on its plate; not currently committed |
| `chk_built_NN.png` | `tools/find_unlettered.py --qc` (needs the PDF) | every word the composed-template pass found — the structures no plate carried a located copy of — boxed on its plate; not currently committed. `--sheet PATH` is the render that matters for that pass: every candidate cut from its own page, which is what the verdicts in `READ` were written from |
| `chk_boxes_30.png`, `chk_boxes_31.png` | the label pass (prose only: METHODS, "Label positions") | the located label boxes on two plates; plate 31 is the page the journal set 118 px low, and this render predates the frame-relative crop, which is why it is 1100 × 700 |
| `chk_AngT_1.png`, `chk_AngT_2.png`, `chk_CAT_0.png` | the index-range adjudication (prose only: METHODS, "Where the index gives itself away") | the candidate impressions of `AngT` on plate 29 and of `CAT` past plate 43, read against the page |
| `preview_p3.png`, `preview_p30.png` | the plate-cropping pass (prose only: METHODS, "Plate images") | two pages at the crop stage, with the detected coordinate box |
