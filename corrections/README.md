# corrections

One file per correction to how a region is drawn -- one plate, one region -- as written by
`fixer.html` or `tools/atlasfix.py` (in a browser) or `matlab/AtlasRegionFix.m` (in MATLAB)
and read by `tools/corrections.py`. One press of **Commit** in the browser sends every plate
that holds marks, a file for each region marked on each, as one commit on one branch:
`correction/<id>` for one file, `correction/<stamp>` for several, the stamp being the moment
they were sent and the prefix of every id on the branch. A file is what a reader said on the plate -- a point
inside a region, a run of boundary the tracing missed, the outline a region should have --
and not a change to the data: the change is one edit to a pipeline input (`svg/`,
`seed_overrides`, `label_positions`), made from it, and the extents are
re-cut. Files here are never edited after they are pushed; the pull request that applied
one is its record, `qc/chk_corr_<id>_site.png` -- the region before and after, which opens
the pull request -- the picture, and `qc/chk_corr_<id>.png` the whole plate.

Schema `gerbil-atlas-correction/1`:

```json
{"schema": "gerbil-atlas-correction/1",
 "id": "20260905T160102Z-p19-S1DZ",           UTC time, plate, abbreviation; also the branch and the file name
 "created": "2026-09-05T16:01:02Z", "author": "dstolz",
 "plate": 19, "ap_bregma_mm": 1.5, "abbr": "S1DZ", "hemisphere": "left",
 "problem": "S1DZ on the left is a scrap; S1J bulges through a gap in the dashed S1J/S1DZ boundary.",
 "seeds": [{"abbr": "S1DZ", "kind": "positive", "page_px": [1079, 955], "mm": [-4.13, -2.877],
            "note": "inside the strip"}],
 "boundaries": [{"style": "dashed", "closed": false,
                 "page_px": [[1162, 1043], [1186, 1061]], "mm": [[-3.548, -3.496], [-3.379, -3.623]],
                 "note": "the run of the S1J/S1DZ boundary the tracing missed"}],
 "extents": [],
 "notes": [],
 "snapshot": "corrections/20260905T160102Z-p19-S1DZ.png",
 "source": {"commit": "3603c09", "site": "https://dstolz.github.io/GerbilAtlasExplorer/",
            "tool": "AtlasRegionFix 1.0", "matlab": "24.2.0.2740171 (R2024b)"}}
```

- `page_px` is the frame the tracings in `svg/` are in (3296 x 2481; plate 20 is 2481 x
  3296) and is what is read; `mm` is `[ML, DV]` for the reader, and `validate` refuses a
  file where the two disagree by more than 0.02 mm.
- A **seed** is a point that is (`positive`) or is not (`negative`) inside the region.
  A positive seed becomes a row of `seed_overrides` -- a seed of its own beside the printed
  labels, or, with `"label_index": i`, one standing in for printed box `i` of that name,
  whose own seed then withdraws. A negative seed is for the reader.
- A **boundary** is a polyline of a run the tracing missed, `solid` or `dashed` as the
  atlas prints it, `closed` for a ring. `apply` writes it into the plate's SVG as cubics
  with `data-correction="<id>"`.
- An **extent** is a ring of where a region's outline should run. Only the parts of it off
  the traced ink are traced; the region is then re-cut, never copied.
- A **preview** (`null` unless the reader ran **Recut**) is what the recut showed before they
  sent it: `{"area_mm2_before": 0.0669, "area_mm2": 0.1008, "changed": ["E", "GrA", "GrO"]}`.
  `corrections.py report` compares the applied fix with it. The published page cannot recut
  and writes none.

The published page pushes the file and its snapshot as one commit, so the branch's first
push is the one that starts `apply-correction.yml`. What happens then: the workflow brings
the branch up to main, runs `inspect --qc`, hands both to a session that applies the fix and
pushes, and opens the pull request from the write-up the session left. If main moves while
the pull request waits, `rebase-corrections.yml` re-cuts the branch on the new main without
a session (`corrections.py rebase`), so two corrections in flight never conflict with each
other at the merge.

```
python3 tools/corrections.py validate corrections/<id>.json     # reads, frames agree
python3 tools/corrections.py inspect  corrections/<id>.json --qc   # against the extraction; qc/chk_corr_<id>.png and _site.png
python3 tools/corrections.py apply    corrections/<id>.json [--dry-run]
python3 tools/corrections.py report   corrections/<id>.json [--against origin/main]   # the numbers, as Markdown
python3 tools/corrections.py rebase   [--onto origin/main] [--dry-run]                # the branch up to main, re-cut
```
