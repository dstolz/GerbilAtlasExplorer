# Methods and provenance

Technical detail behind the [Gerbil Atlas Explorer](README.md): where the data comes
from, how coordinates were calibrated, how the labels were read, and what was checked.

## Where the data comes from

Structure–plate assignments are taken verbatim from the authors' own **Index of
structures** in the open-access paper, not from OCR of the plates:

> Radtke-Schuller S, Schuller G, Angenstein F, Grosser OS, Goldschmidt J, Budinger E (2016).
> Brain atlas of the Mongolian gerbil (*Meriones unguiculatus*) in CT/MRI-aided stereotaxic
> coordinates. *Brain Struct Funct* 221(Suppl 1):1–272. doi:10.1007/s00429-016-1259-0

## Reading the index against itself

The paper prints its structure list twice: an **Index of structures** ordered by name
(pp. S7–S14) and an **Index of abbreviations** ordered by abbreviation (pp. S15–S22).
`data/index_raw.txt` came from the second. `data/index_structures_raw.txt` is the
first, transcribed separately so that the two could disagree, and
`tools/check_indexes.py` compares them.

They agree on all 723 abbreviations, on every structure name, and on every plate range.
That is not independent confirmation of the atlas — both indexes were near certainly set
from one master table, so a mistake in that table sits in both — but it is the only
check available that the 723 entries reached this repository intact, and it passes. The
two differences it reports are in the printing, not the content: `Bar` differs by an
apostrophe, and `VMHVL`'s name is mangled in the Index of structures text layer.

### Where the index gives itself away

What the Index of structures carries alone is its typography. The atlas writes a bare
number for a structure that appears on one plate and a range for one that appears on
several — 104 entries bare, 612 proper ranges. Seven are written with a dash and no
second plate to go with it, and the Index of abbreviations renders three of those as a
plain number, hiding them:

| abbr | printed range | printed on the next plate? |
|---|---|---|
| AngT | `28–28` | yes, plate 29, both hemispheres |
| ZIC  | `34–34` | yes, plate 35, both hemispheres |
| Su3C | `36–36` | yes, plate 37, both hemispheres |
| RLi  | `35–35` | yes, plate 36, one hemisphere |
| CAT  | `43–`   | no |
| IVF  | `25–`   | no |
| MnM  | `34–`   | no |

Those seven are the only entries in the atlas whose printed range is malformed, and the
four set as `N–N` are exactly the four abbreviations the label pass had found printed one
plate past their published range. Two facts that independently single out the same four
entries is not a coincidence worth preserving: the dash is taken at its word, and the
database reads those ranges as N to N+1. It is the one place the database departs from
the printed index, and it is recorded in
`verification.index_range_corrections`.

The other three were checked the same way and came back empty. Every candidate scoring
over 0.55 on the following plates was read against the plate image and was a different
word — `VEn` and `VP` for `IVF`, `MoDG` for `MnM`, and for `CAT` nothing on plates 42, 44
or 45 scored over 0.60 at all. Their dash has no second plate to recover, so they stay
at the single plate the Index of abbreviations gives them.

This restored four printed labels that the app could not previously do anything with:
each was on the page, but excluded from `label_positions` for falling outside its
published range, so it had no box, no region and nothing to point at.

## Coordinates

Plate AP coordinates were read from all 62 plates and match the printed series exactly:

```
bregma(plate n)  = 7.80 - 0.35 * (n - 1)      # plate 1 = +7.80 mm, plate 62 = -13.55 mm
lambda           = bregma + 4.45
interaural       = bregma + 7.25
occipital crest  = bregma + 9.95
```

Those three offsets are the skull landmark distances the paper measures by CT (Table 2).
Two of them are the atlas animal's own: lambda 4.45 mm, interaural line 7.25 mm. The third
is not — Table 2 gives the atlas animal an occipital crest 9.98 mm behind bregma, where the
plate headers use 9.95, which is the median across the ten CT scans. The plate headers are
what the app has to agree with, since they are what a reader reads off the page, so 9.95 is
what the database carries; the 0.03 mm is noted here because it is a difference inside the
paper and not an error in the transcription.

Sections are coronal, perpendicular to the brainstem axis, at 350 µm intervals.
DV zero is the plane through the most dorsal points of cerebrum and cerebellum
(negative = ventral); ML zero is the midsagittal plane.

ML and DV come from each plate's own printed coordinate box, which the frame-relative
cropping (below) makes common to all 62 plates. In the 1100 × 703 frame the ML axis runs
−8 to +8 mm across x = 64 to 976 and the DV axis +1 to −10 mm down y = 39.0 to 663.8.
`plate_frame` in the JSON records the map, and the app reads it from there rather than
carrying its own copy:

```
ML(mm) = (x - 520.0) / 57.0
DV(mm) = (95.81 - y) / 56.80
```

The fit is a least-squares one over the 1 mm tick lattice printed inside that box, read
off all 62 plates: 56.999 ± 0.007 px/mm for ML and 56.798 ± 0.007 px/mm for DV, with no
single-tick residual worse than 0.42 px — tick positions agree within half a pixel on
every plate, including plate 31 with its page offset. Checked against anatomy rather than
against the fit alone: midline structures (`3V`, `Aq`, `4V`, `cc`, `MnR`) land within
0.10 mm of ML 0, and bilateral pairs come out symmetric at the published widths —
`MSO` ±1.33, `LSO` ±1.67, `CIC` ±1.93, `Au1` ±6.48 (mean distance from the midline).

With AP coming from the plate, this gives every one of the 6,266 located labels a full
stereotaxic triplet.

## Plate images

Plates are cropped **relative to the printed coordinate frame**, detected per page,
rather than to fixed page fractions. This matters: in the source PDF the plate 31
figure sits 118 px (at 300 dpi) lower on the page than every other plate, and plates 1
and 10 are offset by 2–3 px. Frame-relative cropping puts all 62 images in one
common coordinate frame.

### The three plates of a level

The atlas prints each of the 62 levels three times — the Nissl-stained section, the
Gallyas myelin-stained section from an adjacent section, and the labelled drawing traced
over them — on consecutive pages of the supplement, with a fourth page carrying that
level's abbreviation list and its CT/MRI reference. All 186 section pages are in the app,
selected with **Labelled / Nissl / Myelin**.

Registration between them is by construction rather than by fitting. Every page carries
the atlas's own printed ML/DV box, and each page is cropped to *its own* box by the same
detector, so all three land in the coordinate frame above — the frame the 6,266 label
positions are recorded in. Nothing is warped, translated or scaled to match anything else.

Three things had to be got right, and each is checked rather than assumed:

- **The box, not a box.** The detector takes the outermost full-length rules. Measured on
  the finished 1100×703 images, the box lands within 0.5 px of (10.25, 10.25)–(1031.5,
  692.25) on all 186.
- **Which way up.** One page — plate 5's Nissl, supplement page S40 — stores its image
  rotated by half a turn. The box and its tick lattice are very nearly symmetric under that
  rotation, so the cue is content: the vertical *dorso-ventral coordinate* caption sits
  outside the box on the right and nothing at all sits outside it on the left. This is read
  on the native page, before the mapping. Turning the mapped image instead is wrong in a way
  that is easy to miss — the box is not centred in the 1100 px canvas, so a half-turn
  there lands it 58 px, a full millimetre of ML, off.
- **The mapping itself.** Re-deriving the 62 labelled plates through the same code lands
  them on the images already in the app, pixel for pixel, on 61 of 62; plate 61 is out by
  one pixel in x.

The myelin section is an *adjacent* section, not the same one — the two stains cannot be
applied to a single slice — and is aligned as the authors published it.

The alternates are stored at the same 1100×703 as the drawings, as greyscale JPEG at
quality 65: 5.8 MB of Nissl and 5.1 MB of myelin, taking the single file from 7.3 MB to
18.2 MB. **Grey** and **Contrast** in the toolbar are a CSS filter on the image, and the
same filter string is set on the canvas the PNG export draws through, so what is saved is
what was on screen. The 3-D view reads whichever source is selected and rebuilds its volume
when it changes; it is left out of the contrast control because Density already does that
job there. A histology section has no contour channel, only tissue, so the weight given to
the tissue channel differs by source and by mode — a slice is composited once and needs
enough to be seen through 62 of them, while a ray is composited at 288 samples and goes
opaque a fifth of the way in at anything near that.

## Vectorized outlines

The **SVG** export saves the plate as paths rather than pixels. The paths are a tracing of
the regional outlines on the published pages, made at 3296 x 2481 px per page, and they are
stored in that page frame rather than rewritten into the app's: `__VEC__[plate].m` is the
matrix that maps one to the other. Keeping the geometry as the tracer produced it means a
bad registration shows as a wrong matrix, which is six numbers to check, instead of being
baked irreversibly into 9,076 paths.

The tracings are in `svg/`, one file per plate, as they came out of the vectorizer — the
same paths the app carries, before any matrix is applied. They are the only source asset
kept in the repository rather than only embedded, because the registration below is
measured against them and the numbers are otherwise unauditable.

The matrix is **fitted to each plate's own printed ink, not read off the page layout**. The
scale is shared and comes from the 1 mm ticks the pages print (142.6 px/mm across ML, 142.2
down DV, against the plate frame's 57.0 and 56.8 — a ratio of 2.502); orientation and
offset are searched per plate over the four right angles and a translation, scored against
the distance from each traced point to the nearest dark pixel of that plate's own image.
This is the part that has to be per-plate: the journal set page 20 at a quarter turn, and
page 31 carries the same displaced figure the plate crops already correct for, which comes
out here as 47 px in the plate frame. Assuming one layout for all 62 would have put those
two silently in the wrong place — the failure mode the alternate plates already have.

Result: **worst plate 1.8 px mean, about 0.03 mm; median 0.77 px, 52 of 62 under 1.2 px.**
Coordinates are
rounded to whole page pixels, 0.4 px of the plate frame, which is well inside the 0.29 px
the tracing itself deviates from the printed line. The bundle adds about 1.9 MB to the
file.

Only the outlines were traced — not the printed abbreviations, the axes or the coordinate
box, and not the histology. An exported sheet is the drawing plus whatever overlays were
on, each in its own named group, with the same caption the PNG carries.

## Label positions

`label_positions` in the JSON records where each abbreviation is printed on each
plate, as `[cx, cy, w, h]` fractions of the frame-cropped image. Most structures
appear twice, once per hemisphere; layered ones such as cerebellar white matter
appear many more times. 6,266 individual labels are located, covering 3,298 of the
3,510 structure-plate entries (94%). These drive the circling, the hover tooltips and
click-to-select in the HTML app and can be reused for annotation overlays elsewhere.

The labels were read twice. The first pass OCR'd 300 dpi renders with Tesseract and
located 4,164 labels. The second pass re-read all 62 plates from the lossless 300 dpi
PNGs embedded in the source PDF, using a recogniser built for this one typeface:
11,985 labelled glyph exemplars harvested from the first pass, matched as
baseline-anchored binary templates, then whole tokens parsed against the 723 published
abbreviations by Viterbi segmentation. Per-character accuracy under leave-one-plate-out
validation is 96.4% top-1 and 99.75% top-3; the vocabulary constraint resolves the rest.
Where two abbreviations are indistinguishable in this font — `Gl`/`GI`, `IPl`/`IPI`,
`GlA`/`GiA` — the published plate ranges break the tie, since those pairs never overlap.

The second pass re-found 96.7% of the first pass's labels and added 2,073 more,
including second-hemisphere labels the first pass caught on one side only (`Au1` on
plate 33, for instance). Every reading that disagreed with an existing record, fell
below the confidence floor, or named a structure the index does not list for that plate
was checked against the plate image by eye. That review superseded 17 first-pass records
where the printed text says otherwise (`Cl`→`DCl`, `Su3`→`Su3C`, `PR`→`PrC`, `ml`→`mlf`,
`Rh`→`PRh`, `La`→`LaV`, `A1`→`A11`, `V1`→`V2L`, `cg`→`Cg1`, `f`→`fr`, `ts`→`rs`, and
cortical-layer digits that are really `S1` and `AI`).

### The words the passes missed

Two passes still left 236 index entries with no located label, and those are
two different things. A structure listed for a plate range is present at those levels but
is **not necessarily printed** on every plate of it, so some were never on the page. Others
were, and were missed — `MPtA` is printed twice on plate 30, in the same type as everywhere
else, and the app could say nothing about it: no box, so no seed, so no area, so nothing to
point at. That is what a reader notices, because it looks like the app has lost a region.

A third pass, `tools/find_missing_labels.py`, reads no letters at all. The atlas sets every
abbreviation in one typeface at one size, so a word missed on one plate is a word already
located on another, and the only question is where that same picture appears again: cut the
greyscale patch out of a plate that carries it, and slide it over the plate that does not,
scoring normalised cross-correlation over the whole page by FFT. Correlation rather than
pixel overlap, because the halftone ground and half a pixel of set-off put binary agreement
between two impressions of the same word at 0.6, which is where the wrong words are too.

**The score filters; it does not decide.** It cannot tell a word from the same word inside a
longer one, and for a short abbreviation that is the whole difficulty: `sol` is printed
inside `5Sol`, `Cu` inside `9a,bCb`, `I` inside `LaV`. Widening the template's white margin
so a neighbouring letter falls into it does not separate them — at every margin tried, a
true `VTT` or `Rh` scores below a false `SHi` — and nothing else does either, short of
reading the letters, which is the pass this one exists to patch rather than repeat. So all
47 candidates were put beside the printed plate and read. **37 were the word and 23 entries
gained one**; the 8 that were not are listed in the tool with what they turned out to be, so
a re-run reproduces the committed data and the judgement can be checked rather than taken.

**The pass is not idempotent, and that matters.** Every label it writes becomes a template
the next run can cut from, so a word invisible to one pass can be unambiguous to the next.
Running it again after the third pass found `mlf` on plate 44 — printed on both sides, the
only plate between 38 and 55 the abbreviation was missing from — which the earlier run had
not had the templates to reach. That fourth pass added 9 labels over 5 pairs: `mlf`, and the
four abbreviations that the index-range correction above had just brought into range. A
fifth pass over that result found nothing, so the run is now at a fixed point, and the four
`CONFIRM` entries in the tool are the mirror of `REJECT` — candidates read against the plate
and found to *be* the word while scoring under the threshold. `Su3C` on plate 37 reads 0.620
where a false `ZID` on plate 33 reaches 0.772, which is the same reason the page and not the
score decides.

Three things hold afterwards, and all three are checked: every located pair is one the
published index lists (0 exceptions); `window.__BOX__` in the app is byte-identical to
`label_positions.data`; and the new boxes sit on ink like the old ones, median coverage
0.274 against 0.300 for the 6,220 already there. One of the 37 falls under the 6% floor —
the single-glyph `I` on plate 23 — which is the class 30 of the existing boxes were already
in, `I` and `1` being too thin to survive the app's downsampled plate.

## The brain outline

`brain_outline` in the JSON gives the outline of the section on each plate: what a track
has to cross to reach a target, and the surface the track planner measures a depth from.
The atlas publishes no segmentation and no brain surface, and the CT skull that ships
here is bone from a different animal — the right surface for deciding where to drill and
the wrong one for deciding how far to drive. So the outline was taken from the drawings
themselves.

It uses the same steps the 3-D view already runs to build its volume, which is the reason
to trust it rather than a second pipeline nobody has looked at: crop to the atlas's own
printed coordinate box at `[14, 14, 1020, 681]` of the 1100 × 703 frame, call a pixel ink
where its smallest channel is below 236, flood the paper in from the border, and keep the
connected components of what the paper did not reach that are larger than
`max(400 px scaled to full resolution, 2% of the largest)`. Holes are filled, so a
ventricle counts as brain. The boundary of each surviving component is traced and
simplified by Douglas-Peucker at 2 px — 35 µm, well inside the atlas's own error — giving
81 polygons over the 62 plates, 8,815 points in all.

**Most plates give one polygon, and the ones that give more do so anatomically.** The
interhemispheric fissure separates the two hemispheres on plates 10–14, the cortex parts
from the midbrain on 37–42, and the cerebellum from the brainstem on 56–59. A reader that
kept only the largest blob would silently lose a hemisphere.

**No morphological opening.** The drawing prints some abbreviations beside the section and
points at them, and the flood runs a few pixels out along those leader lines. An opening
large enough to take them off also eats the thin cortical sheet on plates 36 and 38, which
is real anatomy: at a radius of 3 px the labels falling outside their own outline go from
135 to 316, and 32 of the new ones are on plate 36 alone. The contour is therefore left
honest, and the app's ray-caster takes **the first crossing that is followed by 0.2 mm of
brain** rather than the first crossing outright, which rejects a leader line without
touching the geometry.

Three checks, none of which the extraction was tuned to pass:

| Check | The atlas says | Extracted |
| --- | --- | --- |
| Highest point of any outline | DV 0 is the plane through the most dorsal points of cerebrum and cerebellum | **DV −0.06 mm** — reaches it, never crosses it |
| Lowest point of any outline | the deepest printed label sits at DV −9.02 | **DV −9.09 mm** — just below it |
| Printed labels inside their own plate's outline | — | **97.8%** (6,126 of 6,266) |

Of the 135 labels that fall outside, most are on the olfactory bulb plates 5–9, where the
section is small and the drawing prints the labels beside it; the median one is 0.14 mm
out, and the 90th percentile 0.20 mm.

## Region extents

`label_positions` says where an abbreviation is *printed*. `region_extents` says what it
*names*: the area of each structure on each plate, as a list of closed polygons of `[x, y]`
fractions of the frame-cropped image — the same frame and the same convention
`brain_outline` uses, so the app's existing point-in-polygon test reads them unchanged.
**3,117 structure-plate entries carry an area**, 95% of the 3,298 the label pass located
and 89% of the 3,510 the published index lists, as 5,702 polygons over 77,689 points. Where
the atlas prints two names as one label the two share an entry, so a name having no entry of
its own does not mean it has no area — see step 6.

The atlas publishes no segmentation. What it does publish is a line drawing in which every
region is a cell of a planar subdivision with one abbreviation printed inside it, and both
halves of that are already in this repository: the lines as the tracings in `svg/`, the
abbreviations as `label_positions`. The extents are the third thing neither is alone.

The steps, in order, run by `tools/build_region_extents.py`:

1. **Read the traced paths in the page frame they were traced in** — 3296 × 2481, and 2481
   × 3296 for plate 20, which the journal set at a quarter turn — and flatten the cubics.
2. **Bridge the dangling ends.** The tracing is a nearly connected network: over 1,661 open
   endpoints the median sits **1.9 px** from another path, 94% within 12 px, 99% within 25.
   But a boundary that misses by two pixels leaks two regions into one, so each dangling end
   is joined to the nearest point on another path within 20 px (140 µm). This is far gentler
   than a morphological close, which welds shut the thin laminae the drawing does separate —
   the same objection that kept an opening out of the brain-outline extraction.
3. **Close against `brain_outline`**, inverse-transformed into the page frame, and fill it
   for the section interior.
4. **Cut the empty space into faces.** A face sealed by traced ink and holding exactly one
   abbreviation is that structure's area *as drawn*, and that is 3,404 of the faces.
5. **Split the rest.** Where a face holds several abbreviations, ink is missing somewhere on
   the boundary between them. A watershed seeded on the printed labels and ridged on the
   distance transform of the ink splits the face along the strongest evidence there is. The
   drawn lines themselves belong to no face and are in play, so the split falls down the
   middle of the printed line, where a boundary between two regions ought to fall.
6. **Leave the unnamed faces alone.** A face holding no label is not absorbed by a
   neighbour. The atlas seals it and declines to name it, and the largest such class is the
   ventricles; calling a ventricle `CPu` would propagate into every readout downstream.
   These are written out separately as `region_extents.unassigned`, and they are a mean 7%
   of section area.
   **And do not split a face between two names of one label.** The atlas often
   names a face with two abbreviations typeset into a single label, over one line or two —
   `S1Tr/ LPtA`, `S2/AuD`, `Au1 (A1)`, `Au1 (A1/AAF)` — and the label pass reads each of
   them as the separate published abbreviation it is. Seeded as rivals they are worse than
   useless: there is no ink between two names of one label to split on, so the watershed
   invents a ridge down the middle of the face and hands each a slab of the other, which is
   how `A1` came to be a rectangle across primary auditory cortex rather than the field
   itself. `label_blocks` says which abbreviations the atlas joined, they seed as one, and
   the app answers for any of them with that label's one outline. **22 labels on 31 plates**
   are joined this way, over 37 printed occurrences.

7. **Score each polygon** by the share of its border lying within 3 px of ink the tracing
   *actually drew*, as opposed to a ridge the watershed invented, walked at one pixel so it
   is length-weighted.
8. **Trace and simplify on the crack lattice**, Douglas-Peucker at 2 px as `brain_outline`
   already does.

**Step 8 is not the obvious thing, and the obvious thing is wrong.** Contouring each region
on its own and simplifying its ring gives two different polylines for the same shared
boundary, because Douglas-Peucker is global to the ring it is handed; at a 2 px tolerance
they cross, and the regions then overlap and leave slivers. So the boundary is traced on the
lattice *between* pixels, where both neighbours see the identical chain of corners, and it
is cut at the corners where three or more regions meet — a purely local test, so both sides
cut in the same places. Each arc is simplified once. Douglas-Peucker keeps its endpoints and
is symmetric under reversal, so the two owners of an arc keep the same vertices although
they walk it in opposite directions.

Three checks, none of which the extraction was tuned to pass:

| Check | Extracted |
| --- | --- |
| Every boundary between two regions stored as one polyline, twice | **100%** of directed boundary edges have their reverse in exactly one neighbour, so the regions tile the section — a point is inside exactly one, or inside none |
| Printed labels inside the region they name | **97%** |
| Regions plus unassigned faces against the section area | within **5%** on the worst plate |

**What the numbers do not say is which boundaries are real, so every polygon carries that
too.** `s` is the traced share of that polygon's border: median **0.98**, 76% at or above
0.90, 87% at or above 0.75, **6% below 0.50**. A polygon at 0.98 is the boundary the atlas
prints. A polygon at 0.16 is a split the extraction had to invent because the drawing does
not separate those structures, and it should be read as an estimate — the app dashes those
outlines and says so rather than presenting them as drawn. The weak ones are where a reader
would expect them: `PM` on plates 51–54, `7Cb` on 51, `RRF` on 39, `imvc` on 29 — thin
cerebellar and reticular subdivisions the pages bound with faint or dashed print, if at all.

End to end, in the app: pointing at each of the 6,266 printed labels in turn resolves to a
structure every time, and to the right one 6,263 times. **6,048 of them resolve to an area**
and the remaining 218 to the printed name itself, which is the honest answer where the atlas
prints a name outside the section it belongs to — `rf` on the rhinal fissure is 50 of the
218 — or where no extent could be cut. The three misses are three places where one located
box sits inside another (`StA` around `STMA` on plate 23, `PVP` around `VL` on 29, `psf`
around `sf` on 53) and the smaller of the two wins the point, which is the right tie-break
everywhere else.

262 of the 6,263 printed labels sit outside the face they name, on a leader line or on a
boundary, and were pulled to the nearest face; most are on the olfactory bulb plates 5–9,
where the section is small and the drawing sets the abbreviations beside it. Three could not
be resolved at all and have no extent.

`qc/chk_regions_NN.png` overlays the result on the plate for five levels, tinted green where
the boundary is drawn and red where it is inferred, which is the check a reader can make by
eye and the one that catches a leak the medians average away.

**This is still not a segmentation.** It is one animal's drawing, cut along the lines that
drawing prints, and where it prints none the split is this extraction's guess rather than
the atlas's claim.

### Reading the joins

Which abbreviations the atlas typeset together is not in `label_positions`, and it is not
recoverable from the geometry: two names of one label sit exactly where two names of two
adjacent labels would. What separates them is the punctuation — a slash between them, a
slash ending the line above, a bracket around the line below — so `tools/label_blocks.py`
reads that, and writes `label_blocks`.

It reads it off the **published page at 2558 × 1708**, not the app's 1100 × 703 plate. There
a glyph is 8 px tall, its letters run together and a bracket cannot be told from an `l`; on
the page it is 20 px and the letters stand apart. This is the same source, and the same
reason, as the label pass itself.

Segmentation comes from `label_positions` rather than from thresholding: it already says
which pixels are letters, so **the ink on a line that no box claims is the punctuation**.
Each such stroke is then classified by the path its ink takes down the line — a slash leans
steadily and straight, a bracket bows, with its extreme column at the vertical middle and
both ends falling back, and `l`, `1` and `I` do neither.

One thing had to be ruled out rather than measured. A drawn boundary runs through a label at
any angle and is every bit as thin, as tall and as straight as a slash; every rule of thumb
tried here either kept a boundary or lost a real slash. It did not have to be a rule of
thumb: **the boundaries are already vectorised in `svg/`**, so a candidate lying on a traced
path is a boundary, and that is said rather than guessed. That rules out five would-be joins
— `Sc/Po` on 32, `Or/Py` on 34, `Oca/icp` on 49, `ts/pyx` and `12N/12GH` on 57 — each of
which is two labels with a drawn line between them.

It also costs one true join, and that one is recorded in the tool rather than dropped: on
plate 49 the slash of `PM/ Cop` is drawn along the very boundary it names, and at every
threshold that keeps it, two of those five come back. Every one of the 31 occurrences was
checked against the printed page by eye.

## The third dimension

> **Experimental.** These volumes interpolate across the section gap, which every other
> derivation here refuses to do. Read the next two paragraphs before using them for
> anything you would have to defend.

`brain_outline` and `region_extents` are 62 coronal drawings and nothing between them. The
app's own `plateAt()` says so in as many words — *nothing interpolates between plates: the
outlines are 350 µm apart and an interpolated surface would be arithmetic, not anatomy* —
and quantises an AP to the nearest section rather than blending two.
`data/gerbil_atlas_volumes.json` sets that aside on purpose. It stacks the 62 plates and
fills the six planes between each pair at 50 µm, giving **a brain surface and one mesh for
each of the 697 structures that carry an area**.

**Six planes in seven are arithmetic.** The atlas samples AP twenty times more coarsely
than it samples a section, so what these meshes add along the brain is a linear guess and
not a measurement. Where a structure genuinely changes shape inside 350 µm — and thin
laminae do — the mesh cannot show it. That is the price, it is paid deliberately, and it is
why this is not a segmentation either.

### How it is built

`tools/build_volumes.py`, from the two datasets above and nothing else.

1. **Rasterize each plate** onto a 0.05 mm lattice, reading the stored fractions into
   millimetres with the same `plate_frame` formulae the app uses. The fill is **even-odd
   across all of a structure's rings together**, which is exactly `regIn()` in the app: the
   two hemispheres union, a hole subtracts, and no winding order has to be kept right.
2. **Lay AP out so every plate lands exactly on a sample** — plate *k* at index 4 + 7*k*. A
   plate's own drawing is then never resampled, so the whole of the interpolation is in the
   six planes between two plates and none of it is anywhere else.
3. **Interpolate the signed distance field, not the contour.** Each mask's signed distance
   is blended between neighbouring plates and thresholded at zero. This is the choice that
   carries the result: the section outline splits and rejoins along the series — the
   hemispheres part on plates 10–14, cortex from midbrain on 37–42, cerebellum from
   brainstem on 56–59 — and a scheme that pairs contours between plates has nothing to pair
   across a split. A distance field needs no correspondence at all.
4. **Let every structure compete in the same plane.** Interpolating each structure on its
   own would let neighbours overlap and leave voids in the gap, throwing away the one
   property `region_extents` worked hardest for. So every structure on a plate, together
   with the unassigned faces the atlas seals and declines to name, is blended into the same
   intermediate plane and each voxel goes to whichever field is highest. **The regions
   partition the volume exactly as they partition a section**, and a ventricle stays a
   ventricle rather than being absorbed by whatever borders it.
5. **Close a run's ends rather than extruding them.** Where a structure is drawn on one of
   two neighbouring plates and not the other, its field is tapered out from the plate that
   has it until it is negative everywhere, half a section step beyond. It is *not* blended
   with the absent plate: that side's field is a large negative constant and averaging with
   it would swamp the taper and end the structure flat at the plate.
6. **Bridge a hole in a plate run only where the published index says there should not be
   one.** 49 structure-plate holes are filled that way, as extraction misses; the rest are
   left as the real absences they are.
7. **Surface it** with marching cubes on the distance field, read every 1–6 voxels
   depending on the structure's size — about ten samples across whatever it is. Coarsening
   the *field* rather than decimating the *mesh* is not a detail. A distance field is smooth
   where the mask it came from is not, so the triangles dropped are the ones describing the
   lattice rather than the structure; vertex clustering tuned to the same triangle count
   costs about the same median but two to four times as much in the tail (7.4% median and
   39.8% at the 90th percentile, against 6.1% and 16.7%).

### Grades

| Grade | What it is | Count |
| --- | --- | --- |
| `surface` | At least three consecutive plates. The mesh follows the drawn boundaries, interpolated between them. | 430 |
| `slab` | One or two plates. The series does not sample the structure along AP at all, so the mesh is a **convex hull per connected component** — a claim about where the structure is, not about what shape it is — closed half a section step beyond the plates that name it. | 267 |

A `slab` is what "circumscribed" means here and is marked `bounding: true`. Unlike the
`surface` meshes, two slabs may overlap: a bounding volume is not a partition. The hull is
taken per connected component and never over all of them at once, because one hull around a
bilateral pair would span the midline and claim the brain in between — on a test pair that
is a tenfold overclaim.

Each entry carries its plate runs, its volume and its connected components. **Nothing is cut
at ML 0 on principle.** A bilateral structure comes out as two components and a midline one
as a single component spanning the midline, which is the honest way round: the drawings are
not perfectly symmetric — plates 43 and 44 sit about a millimetre off centre — so cutting
every structure at ML 0 would invent a midline the atlas does not draw. The centres bear
this out against the published widths: `Au1` at ML ±6.5 against the atlas's ±6.48, `LSO` at
±1.65 against ±1.67, `3V` and `cbw` single and on the midline.

### The spurs, and why the opening is a flag rather than a step

The brain-outline extraction above applies **no morphological opening**, because the flood
fill runs a few pixels out along the leader lines the drawing points at its abbreviations
with, and an opening large enough to take those off also eats the thin cortical sheet on
plates 36 and 38, which is real anatomy. The two are only inseparable *within* a section: a
leader-line spur is drawn on one plate, and the cortical sheet runs through many. So
`--despur` opens the volume along **AP alone**, with an element longer than one section step,
which in principle removes anything confined to a single plate and erodes nothing inside a
section.

In practice it does not separate them cleanly enough to be the default. It removes 5.8 mm³,
0.55% of the brain, in **760 pieces spread over 58 of the 62 plates** — not the handful of
filaments the argument predicts — and it costs 88 printed labels their place inside the
surface, taking containment from 97.9% to 96.5%. Some of those 88 sat on a spur and belong
outside; which ones cannot be told from here. Left off, the surface contains **97.9%** of the
printed labels against the **97.8%** the 2-D outline reports. So the geometry is left honest,
as the 2-D extraction left it, and the opening is a flag.

### Checks

The interpolation cannot be checked against anything, because there is nothing to check it
against. What can be checked is that it did not move the plates, and that the 2-D
extraction's own guarantees survived into three dimensions.

| Check | 2-D | Extracted in 3-D |
| --- | --- | --- |
| Cross-section area on a plate a structure was built from, against `region_extents` | — | **median 1.4% off**, 90th percentile 7.1% — the lattice's own quantisation |
| Regions partition the volume | a point is inside one region or none | **holds**: every voxel inside the surface carries exactly one label, or is an unnamed sealed face — 4.5% of the brain |
| Highest point of the surface | DV −0.06 | **DV −0.10** (one voxel) |
| Lowest point of the surface | DV −9.09 | **DV −9.05** |
| Printed labels inside the surface | 97.8% | **97.9%** |
| Printed labels inside the region they name | 97% | **92.7%** — the 2-D figure is after 256 labels were pulled to the nearest face; this one is not |
| Brain volume | not published | **1,046 mm³** |

Two costs are worth stating because they are larger than the interpolation is likely to be.
Reading the distance field coarsely costs a mesh a median **3.9%** of its volume; an
isosurface sitting half a voxel inside the voxels it was cut from accounts for another
**4.9%**, which is not an error but the difference between a surface and a pile of cubes.

And **74% of structures arrive as the one or two pieces anatomy expects**. Where a thin sheet
pinches off into more — `CA1`, the ventricle slits, `DCl` — a median 16% of it sits outside
the largest two. This is reported rather than closed up: closing it would mean growing a
structure into a neighbour, and the partition is worth more than a tidy component count. The
per-component volumes are in the file, so a reader can drop the scraps.

`qc/chk_vol_NN.png` is the picture a reader can check by eye: a plate, the plane interpolated
halfway to the next, and that next plate, side by side and coloured the same way — the
interpolation is either plausible between them or it is not.
`qc/chk_vol_surface.png` and `chk_vol_regions.png` are depth-shaded sagittal, top-down and
coronal views of the whole thing.

**Nothing here is inlined into the app.** The meshes are 21 MB and the app is a single file
you open; how they should reach it — as a side-car fetched on demand, or as a label volume
for the ray-marcher it already has — is a decision the geometry should be looked at first.


## Your own coordinate frame

> **Experimental.** Frame adjustment is new and not yet fully tested. Check adjusted
> coordinates against anatomy you already know before relying on them.

The atlas is cut **perpendicular to the brainstem axis**, which is not how a head sits in
any particular stereotaxic frame. **Frame** in the header takes a pitch, a roll and a yaw
about a pivot you choose, plus a translation, and restates the structure card, the pointer
readout, the coordinate lookup and the CSV export in that frame — keeping the atlas figure
beside each one, so the two can never be confused. The grid, the measure tool, the
projections and the 3-D view stay in atlas coordinates and say so while it is on.

```
pitch  about ML, + = nose down          roll  about AP, + = right ear down
yaw    about DV, + = nose to the right
```

Composed yaw, then pitch, then roll, about the pivot. Rotations do not commute, so the
order is part of the definition, though at a few degrees of roll and yaw it is well below
anything readable off a manipulator. Nothing in the atlas records which way a given frame
is tilted, so the app cannot check a sign; the dialog shows what the frame does to a
familiar structure and the sign is confirmed by reading that back against anatomy.

This is worth more than it might look. At 17° of pitch about the atlas origin the 6,266
labels move a **median of 2.19 mm** — `MSO` goes from AP −7.95 / DV −8.30 to AP −10.05 /
DV −5.64. The displacement grows with distance from the pivot, so the pivot matters more
than the angles do.

### Where zero is

By default the readout's zero is wherever the rotation carries the atlas origin, which is what
the pivot decides — the right reading if you zeroed the manipulator *before* tilting the head.
**Origin** names a landmark instead: drive to it with the head already in the frame, zero
there, and that point reads 0 / 0 / 0 however the head is turned. Lambda in place of bregma is
the common case.

```
origin  none (default)   zero follows the atlas origin through the rotation
        bregma · lambda · interaural · occipital crest
        + an AP / ML / DV offset from whichever of those is named
```

The three numbers are an **offset from the landmark**, not an absolute coordinate, which is
how a zero that is not quite on a landmark gets said: lambda with an AP offset of −0.50 is
half a millimetre behind lambda. Leave them at 0 and zero is the landmark itself. Internally
the landmark contributes only its AP — the atlas prints one for each of these and neither an
ML nor a height — so on those two axes the offset is the whole story. Bregma is landmark 0
and its AP offset is 0, so a stored frame or a link written before the offset existed reads
back unchanged.

Moving zero is not a rotation and is not hedged as one: it moves no point, and every distance
and angle is the one the atlas printed. So with every angle left at 0 the projections rule and
label their axes from the origin, the measure tool needs no caveat, and the header button says
so rather than warning about an approximation that is not being made. Set an angle as well and
the projections, the grid, the measure tool and the 3-D view fall back to atlas coordinates and
say so, as before.

Naming an origin makes the pivot irrelevant, and not by choice: `R(P−piv)+piv` minus
`R(O−piv)+piv` is `R(P−O)` for every `piv`, so re-zeroing on a point *is* rotating about it.
The dialog fades the pivot controls and says so. DV stays yours: 0 zeroes on the brain's dorsal
surface, and anything else is the depth you actually zeroed at. The frame's own offset is still
applied after the rotation, so it survives.

Every readout that quotes an AP names what it is measured from once an origin is set —
`lambda −5.79 · ML ±1.31 · DV −6.94` rather than a bare `AP` — and the CSV's `frame_spec`
column records the landmark, the offset and the atlas coordinate zero ended up at, in place of
the pivot it no longer uses. The landmark is matched on where zero landed rather than on which
one was picked, so an origin reached by typing an offset from bregma still names itself lambda
if that is where it came out. Deep links carry it too, in the flag that used to be a bare `1`
for “an origin is set” and now holds `1 + the landmark's index`, so links written before the
landmark existed still read correctly.

Presets put the pivot on **bregma, lambda, the interaural line or the occipital crest**,
reading each landmark's offset off the plate table rather than carrying a copy of it. A
preset can only set AP and ML, though: the atlas prints an AP for every one of these
landmarks and a height for none. That is not a detail for the interaural line, which is
usually the one you want — pitch turns about a mediolateral axis, so the ear-bar axis is
only the real pivot once you supply how far below your zero it sits. The difference is
large: at 17° of pitch, `MSO` reads AP −10.36 with the pivot left at the interaural AP on
the dorsal surface, and AP −7.73 with the pivot on an ear-bar axis 9 mm lower.

Two consequences the app makes visible. A plate stops being a single AP: under pitch the
AP of a point drifts by `sin θ` per millimetre of DV — about 2.5 mm between the top and
the bottom of the brain at 17° — so the readout gives an AP for the point under the
pointer rather than one figure for the plate. And a coordinate is only foldable to `ML ±x`
while the frame keeps the atlas's bilateral symmetry: pitch does, but roll, yaw and a
mediolateral offset do not, and the card then gives each side separately.

### Angles from measurements

Rather than typing an angle, read two points off the skull with the electrode and let the
slope between them give it — `atan(difference ÷ separation)`:

```
pitch = atan( (DV_posterior − DV_bregma) / AP apart )   + = nose down
roll  = atan( (DV_left      − DV_right ) / ML apart )   + = right ear down
yaw   = atan( (AP_left      − AP_right ) / ML apart )   + = nose right
```

**The three are not equally determined, and the app says so at each one.** The atlas is
bilaterally symmetric, so its own roll and yaw against a symmetric skull are zero by
construction: a roll or yaw measured off symmetric landmarks *is* the deviation from the
atlas, with no baseline to add. Pitch has no such anchor. The atlas prints an AP for
bregma, lambda, interaural and occipital crest and a **height for none of them**, so a
bregma–lambda reading gives the skull's tilt in your frame against *flat skull*, not
against the atlas plane. Using it replaces the pitch angle outright, discarding whatever
atlas offset that field held.

Two practical notes the dialog repeats. A longer baseline is proportionally more precise:
a 0.1 mm depth error over the 4.45 mm from bregma to lambda is **1.3°** of pitch, but only
**0.58°** over the 9.95 mm to the occipital crest. And read the AP span off the manipulator
rather than taking the nominal one — the atlas's 4.45 and 7.25 are separations along *its*
AP axis, and a tilted frame sees them foreshortened, which reads about 0.7° low at 17°. The
roll and yaw spans have no such problem, because you drive the arm to them rather than
read them.

It is a rigid rotation of the published numbers and **not** a resectioning. No oblique
plate is drawn, or could honestly be drawn, from a series sampled 350 µm apart against a
17.5 µm pixel. An adjusted coordinate is a targeting aid carrying the atlas's own error —
a label marks where an abbreviation is *printed* — along with your alignment error and
animal-to-animal skull variation.

## Planning a track

> **Experimental.** New, and not yet checked against a track anybody has driven. Read a
> plan against anatomy you already know before relying on it.

*Plan a track* takes a structure, a hemisphere and three approach angles and returns the
entry point, the angles to set on the manipulator, and the distance from the brain surface
to the target — drawn live on the plate, the projections and the 3-D view, and carried in
the link.

### The angles are in your frame, not the atlas's

This is the decision the rest follows from. The atlas is cut perpendicular to the
brainstem axis and a head in a stereotaxic frame is not, so an angle quoted in atlas
coordinates is one nobody can dial into a manipulator. The target is carried into the
working frame by the same `toFrame()` the structure card uses, the track is built there,
and `fromFrame()` is used only to put it back on the plates for drawing.

Because the drawing is done from the true atlas positions, the picture is exact in any
frame. This is the one tool here that a rotation does not push back into atlas
coordinates, and the only one that needs no "in the atlas frame" footnote.

What that buys is visible at a realistic tilt. With a 17° nose-down pitch and zero on
lambda, `MSO` reads `lambda −5.79 · ML +1.31 · DV −6.94` — and a track that is *vertical
on the manipulator* enters the brain at atlas AP −10.09 rather than −7.95, and is
7.28 mm long rather than 7.51. Neither of those numbers is available from the plate.

### Three angles, two of which set the direction

```
tilt   about ML,  + drives the tip anterior      (entry behind the target)
roll   about AP,  + drives the tip to the right  (entry left of the target)
yaw    about DV,    turns the heading the other two aim in
```

Composed roll, then tilt, then yaw. **Yaw goes outside the other two on purpose.** A
straight probe spun about its own axis points where it pointed before, so a yaw applied to
the down vector first could never do anything at all — which is exactly what composing in
the Frame dialog's order (`roll · pitch · yaw`) would have done. Outside, it re-aims
whichever way the tilt and roll are pointing, and is inert only while both of those are
zero. The app disables the field and says so then, rather than leaving a control that will
not move.

That the order differs from the Frame dialog's is deliberate: that one turns the animal,
this one turns the probe. Each angle is named here by what it does to the tip, for the
same reason the frame names its own by what they do to the head.

Two angles span every direction; the third is redundant, and kept because a manipulator
has three settings and a note that omits one is a note you cannot follow. The panel also
reports the resulting direction as a single angle from vertical plus a heading in words,
which is the form to check against the rig.

### Finding the entry

Marched from 22 mm outside the target back along the approach at 20 µm, then refined at
2 µm inside the step that hit — taking the outermost point that is inside the section
**and** has 0.2 mm of brain behind it. That guard is what makes the honest outline usable:
without it, a leader line would be reported as the brain surface. A solve costs about
**0.9 ms**, so the track redraws on every keystroke.

The surface is the nearest plate's outline, and nothing interpolates between plates: at
350 µm spacing an interpolated surface would be arithmetic rather than anatomy, the same
objection the 3-D view's streaking already carries. An entry AP is therefore quantised at
the section spacing however smooth the drawn line looks.

Two things the panel says rather than hides. The **entry on the flank** — the track went
in through the side of the head, not the top — is found by asking what the dorsal surface
directly above the entry is: more than 0.5 mm of brain above it and the entry is not a
dorsal approach. And a **target outside its own outline**, which is the case for 18 of the
723 structures, whose labels the drawing prints beside the section and points at.

Across all 703 structures that have located labels, at three angle settings each, all
2,109 solves return finite, bounded numbers; 7 return no entry at all, every one of them a
structure whose label centre lies outside the section.

### What it does not do

It plans a **straight track to where an abbreviation is printed** — not to a centroid. The
caveat that runs through this whole project matters most here, because a targeting tool
invites more trust than a coordinate readout does. It knows nothing about vasculature, the
sinus or the ventricles: the outline is a silhouette, and a track through a ventricle is
drawn no differently from one that is not. It does not check the entry against the skull,
which would need the skull overlay to be something to measure against, and it is not. And
the surface is a **fixed, sectioned** brain — the brain sits lower under intact dura, and
lower again once it is opened.

## Projection views

The explorer plots every located label as a point in **AP × DV** (sagittal) or
**AP × ML** (top-down), which the printed atlas cannot show you: a coronal series
gives one plane at a time, and a structure's shape along the brain has to be
reassembled plate by plate in your head. A selected structure is picked out in blue
against every other label, so `CA1` visibly sweeps from near the midline out to
ML ±5 mm as it runs backwards, and the `auditory` system chip lights the whole
ascending pathway from cochlear nucleus to cortex in one view. Hovering a point names
it and reads out its coordinates; clicking one opens its plate.

Two things to keep in mind when reading these plots. A point is a *printed label*, so
it marks where the abbreviation sits, near but not identical to the structure's centre;
and the atlas samples AP in 350 µm steps, which is why the cloud falls into 62
columns — those columns are the plates.

## The 3-D view

The plates are already in one common coordinate frame, so they can simply be stacked
where they belong: each section drawn at its own bregma. The explorer does this three
ways, all from the plate images already on the page — nothing extra is downloaded, and
there is no library.

- **Contours** draws the atlas's own red boundary drawings as a stack. It reads as a
  contour model of the brain because that is exactly what it is.
- **Volume** ray-marches the same field through a 3-D texture.
- **Labels** plots all 6,266 printed abbreviations as a stereotaxic point cloud — the
  projection views with the third axis put back. The `auditory` chip lights the whole
  ascending pathway in one rotatable view.

A selected structure is picked out in blue in every mode, hovering a point names it and
reads its coordinates, clicking one opens its plate, and a ring traces wherever the plate
viewer currently sits. Anterior/posterior clipping cuts the stack to a slab; **Half**
cuts it at the midline. The whole thing is built once, the first time the tab is opened,
in about a second; it needs WebGL 2, and says so plainly if that is missing.

The layers are separable because the plates are not line art: they are Nissl
photomicrographs with a red vector contour overlay printed on top, so isolating the
contour channel is a matter of colour, not tracing. A flood fill inward from the border
drops everything outside the section, which is what keeps the plate number and the
AP-coordinate table out of the volume.

Two limits are worth stating, and the app states them too. Sections are 350 µm apart
while a plate pixel is about 17.5 µm, so sampling *along* the brain is 20× coarser than
across it: the stack really is discrete, and the streaking in the volume view is
interpolation between slices, not anatomy. And a label point marks where an abbreviation
is *printed*; most structures carry only a handful — six is the median — so a single
structure reads as a sparse arc rather than a shape. **None of this is a segmentation**,
and no surface is fitted to those points. The surfaces that do exist are the separate,
offline ones in [The third dimension](#the-third-dimension) above; the app does not carry
them.

### The skull

> **Experimental.** The skull overlay and its registration are new and not yet fully
> tested. Treat it as context around the stack, not a surface to measure against.

The skull shows in three places, all off by default. **Skull** in the 3-D controls
wraps the stack in the surface as a translucent shell whose opacity the **Bone** slider
sets — the far wall drawn behind the sections and the near wall in front, so the stack
reads as sitting inside the case, with **Half** cutting bone and brain at the same
midline. **Skull** in the plate controls traces the surface's cut through the current
coronal plane over the plate (the mesh is sliced in the browser, once per plate, and
the PNG export carries the trace). And **Skull** in the projection controls draws the
skull's silhouette around the label cloud — flattened along the unplotted axis exactly
as the labels are — widening the axes just enough to hold the bone. Deep links carry
all three (`&sk=<opacity>` for the shell; `k` and `K` among the `&v=` flags).

**Landmarks** rides on the same registration. The atlas prints an AP for bregma, lambda,
the interaural line and the occipital crest and a height for none of them, so the AP rules
are exact and drawn whatever the skull says, while the marker heights — the vault at each
landmark's AP — and the ear canals the interaural line runs between (ML ±10.4, DV −9.1,
putting bregma 8.8 mm above the ear-bar plane) are read off the fitted mesh. A point
landmark is drawn only on the plate whose plane it falls in; the interaural line is a
mediolateral axis, so it is solid in its own plane, a dashed height reference elsewhere, a
point seen end-on in the sagittal projection, and a real line only in the top-down one.

The source is a µCT surface of a gerbil skull (`GerbilSkull.stl`, 498k triangles as
scanned) — a different animal from the atlas's, in scanner coordinates. The atlas
prints no skull surface, so the registration had to be computed, and it follows the
paper's own recipe: Radtke-Schuller et al. define bregma, lambda and the occipital
crest by intersecting lines approximating the sutures, print an AP for each landmark
(bregma 0, lambda −4.45, interaural −7.25, occipital crest −9.95), and level the
atlas on the plane through the most dorsal points of cerebrum and cerebellum.

The fit uses those features, found on the scan itself, then refines against the
plates. The scan's bilateral symmetry fixes the midline (it lay rolled −13.6° in
scanner axes; residual yaw 0.1°). The **coronal suture** is visible as a groove
chevron in a high-pass-filtered height map of the vault; extrapolating its arms to the
midline — the paper's own construction — gives bregma, constrained to AP 0. The two
**ear-canal openings** are constrained to the interaural line at AP −7.25, the
**occipital crest** weakly to −9.95. Tilt and height are then set by the
**drawn sections of all 62 plates**: the outer boundary of every section was
extracted, and the signed clearance from each dorsal-arc boundary point to the first
bone along its outward ray — measured against the full-resolution scan — is levelled
iteratively, tilting until the clearance no longer trends with AP (slope
0.0004 mm/mm at convergence) and setting the height to a small positive roof gap.
That lands at pitch −21.6° of the scan's long axis. The three axis scales are fitted
separately rather than kept uniform, because the two animals are not the same shape:
AP ×1.032, ML ×1.042, DV ×0.957 relative to the CT's own millimetres. The DV shrink is
what seats the calvaria on the cortex — the scanned skull's vault sits about a
millimetre proud of the atlas animal's brain at the midline — and an atlas-AP stretch
only changes *which* cross-section of the scan lands on each plate, so it never
distorts the ML/DV outline drawn on any one plate. The **lambdoid suture could not be resolved** in
this scan, so lambda is the one printed landmark not independently anchored.

The plates were deliberately given the last word over the landmarks, because the two
disagree by a few tenths of a millimetre and the sections are what the skull is drawn
against. After the tilt is set by the plates, the suture-derived bregma reads
AP +0.5, the ear canals −7.6 against the printed −7.25, and the foramen magnum
centre sits 0.5 mm above the cord on the last plates — each within roughly the sum
of its own measurement uncertainty and the skull-shape difference, and stated here
rather than fitted away. The residual that remains in the overlays: this skull's
**posterior fossa runs shallower** relative to its calvaria than the atlas animal's,
so the cerebellar plates still sit closest to the roof (about +0.1 mm median
clearance, against +0.4 over the cerebrum) — a shape difference no rigid fit can
remove. Expect registration error of a few tenths of a millimetre on top of the
animal-to-animal variation that any skull-to-atlas comparison carries.

For the page the mesh is decimated to 70k triangles (0.42 mm vertex clustering, then
interior surfaces that are never visible from outside — turbinates, the inner ear —
dropped), quantised to 0.01 mm and embedded as ~0.75 MB of base64, which is where the
page's size grows beyond the plate images; the projection silhouettes ride along as a
few kilobytes of polylines. Smooth normals are rebuilt at load, and nothing is decoded
until a skull control is first turned on.

## Known discrepancies with the published index

`label_positions` holds only structure-plate pairs the published index lists. Two
abbreviations are printed beyond their published range with nothing in the index's own
typography to justify extending it, and are recorded under
`verification.known_source_discrepancies` instead: **cg** on plate 35 (index: 17–34)
and **Sol** on 52 and 59 (49–50). Both were confirmed by eye on the plate; the database
follows the published index for them. `Sol` in particular is printed inside longer
abbreviations that *are* listed at those levels — `5Sol` on 52, `SolM` and `SolC` on 59
— so what is printed there may not be the abbreviation `Sol` at all.

The four abbreviations whose published range is itself malformed are a separate case and
are handled above, under [Where the index gives itself away](#where-the-index-gives-itself-away).

System tags (`auditory`, `hippocampal`, `thalamus`, …) are a convenience layer added on
top of the published nomenclature and are not part of the original atlas. The `auditory`
tag covers the full ascending pathway: cochlear nuclei → superior olivary complex →
lemniscal nuclei → inferior colliculus → medial geniculate → cortex.
