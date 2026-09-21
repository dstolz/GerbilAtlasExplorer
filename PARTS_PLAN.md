# Plan — wholes and their parts

A design for folding a structure's named parts back into the structure they are parts
of, at the reader's option: pick the claustrum, `Cl`, and have it outlined, measured and
drawn in 3-D on every plate the atlas says it is on — including the eleven plates where
the atlas prints no `Cl` at all and draws the dorsal and ventral parts, `DCl` and `VCl`,
in its place.

**Not built.** This is the plan only. Every number in it was read off the committed
database on 2026-09-21 and is stated so that it can be checked; the section at the end
says how.

## The case

The published index lists the claustrum on plates 12–27. The plates print it as one name
on five of those and as two names on the other eleven:

| plates | what the atlas prints | what the database holds for `Cl` |
| --- | --- | --- |
| 12–15 | `Cl` | a label, an extent, voxels |
| 16–26 | `DCl` and `VCl`, never `Cl` | nothing: no label, no extent, no voxel |
| 27 | `Cl` | a label, an extent, voxels |

So `Cl`, `DCl` and `VCl` are three structures in the database, as they are three rows in
the index, and the whole is only ever drawn where the parts are not. Nothing is wrong with
that: it is what the atlas does, transcribed. But it makes the app say two things a reader
of the atlas would not:

- Select `Cl` and step to plate 20, and the plate says *"Cl is at this level, but its
  printed label was not located on plate 20."* The label was not located because the atlas
  did not print one; it printed `DCl` and `VCl` instead, and the app knows both are there.
- The card, the structure table and the 3-D view give `Cl` a volume of 0.7296 mm³ — five
  plates' worth. The parts hold another 0.256 and 0.640 mm³ over the eleven plates
  between. The claustrum the index describes, plates 12 to 27, is 1.6256 mm³, and no
  number on the page says so.

The claustrum is the clearest instance and not the only one. Of the 723 published names,
165 say in their own name that they are a *part* of something (*"dorsal part of
claustrum"*, *"lateral habenular nucleus, lateral part"*). For 78 of them the atlas also
names the whole; for the other 87 it does not (`BLA`, `BLP` and `BLV` are parts of a
basolateral amygdaloid nucleus that has no row of its own). Among the 78, the plates sort
the whole/part pairs into three kinds:

| kind | wholes | what the plates do |
| --- | --- | --- |
| **A1** — the parts stand in for the whole inside its published range | 9 (`Cl`, `Cu`, `DM`, `LDTg`, `LHb`, `La`, `MPB`, `VG`, `VMH`) | on 24 structure–plate pairs the index lists the whole, the plate prints only its parts, and the whole has no label and no extent there |
| **A2** — the parts lie outside the whole's published range | 23 (`ZI`, `DR`, `MD`, `ST`, `Sol`, `APT`, `MVe`, `VNLL`, …) | the index gives the whole a shorter range than its parts; folding would extend a structure past what the index says |
| moot | 7 (`12N`, `AM`, `Gi`, `LRt`, `PL`, `RCh`, `RtTg`) | the part is only ever printed beside the whole, so there is no plate where it stands in |

The 24 A1 pairs are 24 of the 161 index-listed structure–plate pairs that carry no located
label today, and 24 of the 424 without an extent. Every one of those 24 is a plate where
the atlas drew the structure under its parts' names. That is the gap this plan closes, and
it is the only gap it closes.

## What is decided

1. **Nothing published changes.** `structures[].plates` stays the index's. `label_positions`,
   `region_extents`, the volumes, the NIfTI label volume and its LUT, the facemaps and every
   CSV that exists today are untouched. A part stays a structure with its own row, label,
   outline, mesh and colour. The whole/part table is one more additive block, like `groups`,
   and is marked as an addition made here in the same words.
2. **A whole is folded only where the published index puts it and the plate prints only
   its parts.** That is kind A1 and nothing else. The tool refuses a row that would extend a
   structure past its published range (A2), and lists those pairs in its report as seen and
   not folded, so the exclusion is on record rather than an omission. Wholes the atlas
   does not name (the 87) are not invented; see *Left out*.
3. **Off by default, and carried in the link.** With the fold off the page is the page it is
   today, except for two sentences that are true whether or not anything folds (the card
   names the parts; the plate message says the atlas drew `Cl` as `DCl` and `VCl` here).
   With it on, every folded number is labelled as folded beside the atlas number, never in
   its place — the discipline the working frame already follows in the CSV.
4. **No new geometry.** The folded outline is the parts' outlines with the wall between
   them dropped, by the edge cancellation `grpRing()` already does for divisions; the folded
   mesh is the whole's and the parts' meshes drawn together, as a division's is; the folded
   volume is their sum, which is exact because the regions partition the volume (the label
   volume holds no `Cl` voxel on plates 16–26; verified below). Interpolating a single mesh
   across the seam is a later, separate decision; see *The third dimension*.
5. **Vocabulary.** The atlas's own: a *whole* and its *parts*; the reader *folds* the parts
   into the whole. The block is `parts`, the tool `tools/build_parts.py`, the table
   `data/gerbil_atlas_parts.csv`. "Division" keeps meaning a gross division.

## The table: `tools/build_parts.py`

Modelled on `tools/build_groups.py`: a declarative list at the top of the file that can be
read and argued with, a `--report`, a `--check` that CI runs, and a block written into the
database by `atlaslib.load_db` / `save_db` so the file keeps its layout.

```python
PARTS = [
    dict(whole='Cl', parts=('DCl', 'VCl'),
         note='Plates 16-26 print the dorsal and ventral parts and no Cl; the index '
              'lists Cl on 12-27. Read on the plates.'),
    dict(whole='LHb', parts=('LHbL', 'LHbM'), note='...'),
    ...
]
```

A row names the whole, its parts and the evidence. Everything else is computed from the
database and refused if it does not hold:

| computed | rule |
| --- | --- |
| `stand_in_plates` | every plate the index lists for the whole on which the whole has no located label and no extent, and at least one part has an extent |
| `own_plates` | the plates the whole has an extent on itself |
| `shared_plates` | plates where the whole and a part are both drawn (`Cu` and `CuR` on 55; `La`, `LaD` and `LaV` on 27): the fold unions them, and the row says so |
| refused | a whole or part the atlas does not name; a part whose name does not say it is a part of the whole (overridable per row with a stated reason); a part printed outside the whole's published range (A2) — the row is rejected, not clipped; a row with no stand-in plate (moot) |

`--report` prints every candidate the name pattern finds — the 78 — and files each as
admitted, A2 or moot, so a later re-cut of the extents that turns a moot pair into an A1
one fails `--check` the way a change to `FREE` fails `build_groups.py`. The nine rows and
their computed plates, as the data stands:

| whole | parts | index range | whole drawn on | parts stand in on | shared |
| --- | --- | --- | --- | --- | --- |
| `Cl` | `DCl` `VCl` | 12–27 | 12–15, 27 | 16–26 | — |
| `Cu` | `CuR` | 52–62 | 52–55, 57–62 | 56 | 55 |
| `DM` | `DMC` `DMD` `DMV` | 29–32 | 29, 30, 32 | 31 | — |
| `LDTg` | `LDTgV` | 42–44 | 42, 44 | 43 | — |
| `LHb` | `LHbL` `LHbM` | 28–31 | 28, 31 | 29–30 | — |
| `La` | `LaD` `LaV` | 26–31 | 26, 27, 31 | 28–30 | 27 |
| `MPB` | `MPBE` | 43–45 | 43, 45 | 44 | — |
| `VG` | `VGMC` `VGPC` | 29–34 | 29, 30, 33, 34 | 31–32 | — |
| `VMH` | `VMHC` `VMHDM` `VMHVL` | 28–31 | 28, 31 | 29–30 | — |

Two of these are worth reading on the plate before they are admitted. `MPB` on 44 prints
only `MPBE`, the *external* part; whether the rest of the medial parabrachial nucleus is
drawn there unlabelled, or is what the atlas means by the whole at that level, is a
judgement the row's note has to make. `Cu` on 56 prints only `CuR`, the rotundus part, and
the same question applies. The rule admits both; the note is where a reader would argue.

The block, as it goes into the database:

```
parts: { note, data: [ { whole, parts, stand_in_plates, own_plates, shared_plates, note } ] }
```

`data/gerbil_atlas_parts.csv` writes it flat, one row per whole, through
`export_tables.py`. `atlaslib.atlas_payload` carries `parts` beside `groups` into
`window.__ATLAS__`. `pipeline.py` gains `('parts', ['build_parts.py', '--check'])` in
`CHECK`. `DERIVED_PATHS` gains the CSV.

Tests, beside the three the groups have in `tests/python/test_data.py`:

- `test_parts_are_well_formed` — every name is a structure; every stand-in plate is inside
  the whole's index range, has no label and no extent for the whole, and has an extent for
  at least one part; the three plate lists are disjoint and their union is inside the range.
- `test_part_outlines_close` — on every whole/stand-in plate pair, and every shared plate,
  the edge cancellation over the parts (plus the whole where it is drawn) leaves closed
  rings. The loop in `test_group_outlines_close` does this already; it is run over the new
  block.
- `test_parts_report_is_complete` — the set of admitted wholes, the set of A2 wholes and the
  set of moot wholes are each what the tool prints, so a re-cut cannot silently create or
  lose a candidate.

## The app

The table reaches the page as `DB.parts`. The app derives two maps once, the way it
derives `grpsOf`: `partsOf[whole]` → the row, and `wholeOf[part]` → the whole. Nothing
about a part's own record changes.

### Always on: two true sentences

Neither of these depends on the toggle, and both should ship before it.

- **The card.** A whole's card gets a row after *Divisions*: *Drawn as* `DCl` `VCl` *on
  plates 16–26*, the abbreviations as buttons that select the part, like the *Made of*
  buttons on a division's card. A part's card gets *Part of* `Cl`, a button.
- **The plate.** `markSel()` has a branch for a selected structure that is on the plate by
  the index but has no located label. On a stand-in plate it now says *"On plate 20 the
  atlas draws Cl as DCl and VCl"*, and offers to fold. The old sentence stays for the other
  137 pairs, where it is the right sentence. `tipBody()` for a hovered part appends *part
  of Cl* where the plate is a stand-in plate.

### The fold

A toggle in the plate controls, *Fold parts into wholes*, held in a boolean beside `mcOn`,
written to the link as the letter `F` in the `v=` flags (`r g s m k K l L y T C` are taken),
and read back in `readHash()`. Everything below is conditional on it.

| where | what changes | how |
| --- | --- | --- |
| `regBuild(pl)` | on a stand-in or shared plate, `out.by[whole]` is the union of the parts' entries (and the whole's own, where drawn) | `grpRing()` over the parts, exactly as `grpRegion()` builds a division; into `out.by` only, never `out.regs`, so a click still lands on the structure the atlas named |
| `markSel()` | selecting the whole outlines the union in the structure colour | the `regOut()` path already draws whatever `regBy[sel]` holds; the sentence says *outlined · drawn on this plate as DCl and VCl · 0.256 mm² on this plate* — the area is the parts' areas summed, and `regTxt()`'s traced fraction is the area-weighted one `grpRegion()` already computes |
| `galThumb()` | the whole's gallery draws the union on stand-in plates | it reads `regBuild(p).by[a]`; the cache key gains the fold state |
| `ptsOf[whole]` | the whole's labels are pooled with its parts' labels on stand-in and shared plates | as a division pools its members' on its plates; the atlas array and the pooled array are both built at load and `foldSet(on)` swaps which one the nine keys hold, so `coordsOf()`, `extentOf()`, the projection, the reverse lookup and the planner read a whole the way they read anything else |
| the card | *Label center*, *Label spread* and the label count show the pooled figures, each marked *folded* with the atlas figure beside it | the `fc` / `fx` pair the working frame already uses for a second reading |
| `v3flags()` | the whole's dots in the cloud include the parts' on stand-in plates | the same membership test a division uses |
| `meshList()` / `v3note()` | the whole draws as its own mesh and its parts' together; the note says *Cl as 3 meshes: its own on plates 12–15 and 27, and DCl and VCl standing in for it on 16–26: 1.6256 mm³ in all* | `meshGroup()` over `[whole, ...parts]`; the sum is of `volume_mm3`, exact because the regions partition |
| `meshSTL` | exporting the whole writes the three meshes as one file, as a division does | no change to the writer |
| `exportCSV()` | with the fold on, columns `folded_label_AP_bregma_mm`, `folded_label_ML_abs_mm`, `folded_label_DV_mm`, `folded_n_labels`, `folded_parts` are appended after the atlas columns for every row; blank where nothing folds | the frame's rule: never in place of the atlas columns |
| `tgTarget()` | a plan aimed at a folded whole reads the pooled labels; the path through the tissue still names the part it passes through, since `regAtOn()` reads `out.regs` | the notes say *target Cl (folded: DCl, VCl)* so a plan printed for the rig says which |
| caches | `REGC`, `GALC`, the projection and `v3flags` are rebuilt on toggle; `tgSolve()` re-runs if the target is a folded whole | `foldSet()` clears them the way `frameApply()` does |

What the fold does not touch, and should say it does not:

- **The map colouring.** A region wears one colour where it is drawn; on plate 20 the
  regions are `DCl` and `VCl`, and the whole is not one.
- **The hit test.** Hovering or clicking on plate 20 answers `DCl` or `VCl`, with *part of
  Cl* appended, never `Cl`.
- **The Labels CSV**, the label table and the background label cloud. A row is a printed
  label; the plate prints `DCl`.
- **The NIfTI, the LUT, the GeoJSON, the facemaps, the fixer.** A reader who wants a
  folded label volume remaps `DCl` and `VCl` to `Cl`'s id with the parts CSV; the README
  says so in one sentence rather than shipping a second volume.
- **The structure list.** The parts stay in the list; the count stays 724.

Tests, in `tests/js/api.spec.js` beside the three the divisions have:

- with the fold on, a folded whole outlines exactly the ground its parts cover on every
  stand-in plate — the 400-point sampling test the divisions already run, over the nine.
- `#p20/Cl&v=F` round-trips through `writeHash()` / `readHash()`, and `state()` reports the
  fold.
- with the fold off, `#p20/Cl` says the atlas draws it as `DCl` and `VCl`, and outlines
  nothing; with it on, `#om` holds one path.
- the card for `Cl` lists two part buttons; the card for `DCl` has a *Part of* button that
  selects `Cl`.
- the 3-D note for `Cl` with the fold on names three meshes and 1.6256 mm³; with it off,
  one mesh and 0.7296 mm³.
- the structures CSV with the fold on carries the five folded columns, and the atlas columns
  are byte-identical to the export with it off.

`smoke.spec.js`'s control-strip test already sweeps every view on a phone; the new toggle
is one more control in a group it measures.

## The third dimension

The first cut draws the whole's mesh and the parts' meshes together, which is what the
plate view does and invents nothing. It leaves a seam. `build_volumes.py` tapers a
structure's field to nothing over half a section step beyond the last plate of a run, so
between plates 15 and 16 the `Cl` field fades out while the `DCl` and `VCl` fields fade in,
and the three meshes stand a fraction of a step apart where the atlas describes one
continuous structure.

The right fix is in the builder, not the page: a whole with stand-in plates is
interpolated as one run, its own mask on 15 blended into the union of its parts' masks on
16, and a `folded` mesh written beside the whole's own. That is new derived geometry — an
interpolation across a seam the atlas does not draw across, though the index asserts
continuity — and it costs a full rebuild of the volumes, so it is a separate decision after
the fold has been used. If it is taken, `checks.regions_partition_the_volume` still has to
hold for the unfolded labels, and the folded mesh is a second surface over the same voxels,
not a second label.

One rule should be made explicit now, whichever way that goes. The builder bridges a hole in
a structure's plate run where the published index lists the missing plate; for `Cl` the
index lists 16–26 and the plates hold no `Cl` voxel there today, so either no bridge
survived the blend between plates 15 and 27 or a bridged field lost every voxel to the
parts' own masks. The outcome is right and the reason is not written down — the build log's
*bridged N structure-plate holes* line would say which. A hole the parts fill is not a
hole to bridge, and `published_plates()` should read the `parts` block and leave the
stand-in plates out of `want`, so the result is by rule.

## Left out, and why

- **A2 pairs** (23 wholes). Folding `ZID`, `ZIV`, `ZIR` and `ZIC` into `ZI` would carry the
  zona incerta from plates 28–29 to 26–35. Anatomically it is; by the published index it is
  not, and every range in this database is the index's (`tools/check_indexes.py` holds it
  to that). If they are wanted later they are a second tier of the same table, with the
  plates outside the index range marked as such in every reading, and the plan for that is
  a paragraph, not a rewrite. Not in the first cut.
- **Wholes the atlas never names** (87 parts). A `BL` made of `BLA`, `BLP` and `BLV` is a
  new name, which is what a division is; a `groups` row keyed `@bl` with a `tier` field
  would do it with no new code. Whether nucleus-scale divisions are wanted is a separate
  question, and mixing them into the twenty-one gross ones would change what *Divisions*
  means in the list. Not in the first cut.
- **Folding by default.** A reader who did not ask sees the atlas as printed.
- **Merging parts into wholes in the data.** Renaming `DCl` and `VCl` to `Cl` in
  `region_extents`, or adding a `Cl` extent on plate 20 by hand, would put into the
  transcription a claim the plate does not print. Every promise in `METHODS.md` about what
  an outline is rests on not doing that.

## Order of work

| step | what | touches | size |
| --- | --- | --- | --- |
| 1 | `tools/build_parts.py`, the block, the CSV, the three tests, the pipeline check, `atlas_payload` | `tools/`, `data/gerbil_atlas.json`, `data/gerbil_atlas_parts.csv`, `tests/python/test_data.py` | ~250 lines, one PR |
| 2 | the two always-on sentences: card rows, the plate message, the hover suffix | `src/app.js`, `src/app.html` (About) | ~60 lines |
| 3 | the fold: toggle, link flag, `regBuild`, `markSel`, gallery, pooled labels, cloud, meshes, CSV columns, caches, planner note; the six browser tests | `src/app.js`, `src/app.html`, `src/app.css`, `tests/js/api.spec.js` | ~250 lines |
| 4 | docs: `METHODS.md` a section after *Gross divisions*, `README.md` a bullet and a table row, `wiki/Finding-Structures.md` the two card rows, `tools/README.md`, `CHANGELOG.md` | | |
| later | the folded run in `build_volumes.py`; A2 as a second tier; nucleus-scale divisions | separate decisions | |

Steps 1 and 2 can ship without 3 and are worth shipping on their own: after them the page
never tells a reader that a label was not located when the atlas printed the parts instead.

## Numbers, and how to check them

Read off `data/gerbil_atlas.json`, `data/gerbil_atlas_volumes.json`,
`data/gerbil_atlas_labels.nii.gz` and `data/gerbil_atlas_structure_table.csv` as committed
at the time of writing.

| figure | value | where |
| --- | --- | --- |
| `Cl` index range; plates with a label; with an extent | 12–27; 12–15, 27; the same | `structures`, `label_positions`, `region_extents` |
| `DCl`, `VCl` index range; plates with a label; with an extent | 16–26; 16–26; 16–26 | same |
| `Cl` voxels per plate plane, 16–26 | 0 on every one | the NIfTI, id 126, read at each plate's bregma plane |
| `Cl`, `DCl`, `VCl` volume | 0.7296, 0.256, 0.64 mm³; sum 1.6256 | `volumes.data[].volume_mm3` |
| `Cl`, `DCl`, `VCl` mesh volume | 0.6771, 0.2362, 0.5375 mm³; sum 1.4508 | `mesh_volume_mm3` |
| `Cl`, `DCl`, `VCl` area over their plates | 2.155, 1.043, 2.231 mm² | `structure_table.area_mm2_sum` |
| located labels | 10, 22, 22 | `structure_table.n_labels` |
| names that say *part* | 165; 78 with a named whole; 87 without | the name pattern `", … part"` / `"… part of …"` over `structures` |
| A1 / A2 / moot wholes | 9 / 23 / 7 | the classification in *The case* |
| A1 structure–plate pairs | 24, all without a label and without an extent | same |
| index structure–plate pairs without a located label; without an extent | 161 of 3,514; 424 | `structures[].plates` against `label_positions` and `region_extents` (3,514 rather than the index's 3,510 because `SHy` is carried; see `known_source_discrepancies`) |
| hash flag letters in use | `r g s m k K l L y T C` | `readHash()` |

The classification is reproduced by the `--report` of step 1; until then, the script that
produced it is the pattern match and the plate-set arithmetic described under *The case*.
