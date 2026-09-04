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

With AP coming from the plate, this gives every one of the 6,322 located labels a full
stereotaxic triplet.

## Plate images

Plates are cropped **relative to the printed coordinate frame**, detected per page,
rather than to fixed page fractions. This matters: in the source PDF the plate 31
figure sits 118 px (at 300 dpi) lower on the page than every other plate, and plates 1
and 10 are offset by 2–3 px. Frame-relative cropping puts all 62 images in one
common coordinate frame.

### The three plates of a level

The atlas prints each of the 62 levels three times — the Nissl-stained section, the
Gallyas myelin-stained section from an adjacent section, and the labeled drawing traced
over them — on consecutive pages of the supplement, with a fourth page carrying that
level's abbreviation list and its CT/MRI reference. All 186 section pages are in the app,
selected with **Labeled / Nissl / Myelin**.

### The MRI, as a fourth source

`mri_frame` in `data/gerbil_atlas.json` records how the atlas's own reference MRI volume
maps to stereotaxic millimeters, and `tools/build_mri.py` resamples it into the same
1100 × 703 coordinate box as the three published plates, writing `data/plates/mri/NN.jpg`.
Where those files are present the app offers **MRI** beside the other three; where they are
not, the button is absent and nothing else changes.

The volume is 256 × 256 × 72 at 117 µm in plane. Its slice spacing is not recorded in the
file and was recovered as 350 µm — the atlas's own plate spacing — so `plate = 62 − slice`
falls out rather than being fitted, and reproduces all 62 plates' bregma exactly.
`build_mri.py --verify` is the check: projecting `brain_outline` onto each slice, the
median best shift over all 62 plates is 0.000 mm in both DV and ML, with about 0.39 mm of
scatter. Slice 18, the only slice carrying a burned-in mark, is bregma −7.25, the atlas's
interaural zero; neither that nor the plate correspondence was fitted for.

Three things it is not, and the app says all three. It is a **whole head** — skull, scalp,
eye and turbinate are in the picture, where the other three sources are cut sections on
paper. It is **coarse**: 117 µm voxels against the 18 µm the frame is drawn at, so it is
soft wherever the drawing is sharp. And it is the **only source whose registration to the
frame was computed here** rather than published — the other three are registered by
construction through the atlas's own printed coordinate box.

It is also the only source that is not inlined into the pages. The other three ride in as
data blobs; the MRI is fetched from `data/plates/mri/` at run time, and the app decides it
is there by loading one of the images rather than by being told at build time. That began
as a way of keeping an optional download out of a byte-for-byte page check, and it stays
because it is what lets the lean page carry a fourth source for the cost of a request
rather than of two megabytes. The single-file bundle therefore has the MRI only when it is
opened beside a `data/` folder, where the other three are inside it.

The images here are 8-bit and JPEG-compressed at 550 × 352, resampled onto the plate
frame — about a third the bytes of storing them at the frame's own 1100 × 703, which would
buy nothing, since the voxels are 6.7 times coarser than the frame either way. Anything
quantitative should go back to the source volume rather than to these. See
`LICENSE-DATA.md` for the terms they are reproduced under.

Registration between them is by construction rather than by fitting. Every page carries
the atlas's own printed ML/DV box, and each page is cropped to *its own* box by the same
detector, so all three land in the coordinate frame above — the frame the 6,322 label
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
  that is easy to miss — the box is not centered in the 1100 px canvas, so a half-turn
  there lands it 58 px, a full millimeter of ML, off.
- **The mapping itself.** Re-deriving the 62 labeled plates through the same code lands
  them on the images already in the app, pixel for pixel, on 61 of 62; plate 61 is out by
  one pixel in x.

The myelin section is an *adjacent* section, not the same one — the two stains cannot be
applied to a single slice — and is aligned as the authors published it.

The alternates are stored at the same 1100×703 as the drawings, as grayscale JPEG at
quality 65: 5.8 MB of Nissl and 5.1 MB of myelin, taking the single file from 7.3 MB to
18.2 MB. **Gray** and **Contrast** in the toolbar are a CSS filter on the image, and the
same filter string is set on the canvas the PNG export draws through, so what is saved is
what was on screen. The 3-D view reads whichever source is selected and rebuilds its volume
when it changes; it is left out of that filter because a filter on an `<img>` cannot reach
a 3-D texture, and it stretches the same tissue in the renderer instead — see
[the tissue curve](#the-tissue-curve) below. A histology section has no contour channel,
only tissue, so the weight given to the tissue channel differs by source and by mode — a slice is composited once and needs
enough to be seen through 62 of them, while a ray is composited at 288 samples and goes
opaque a fifth of the way in at anything near that.

## Vectorized outlines

The **SVG** export saves the plate as paths rather than pixels. The paths are a tracing of
the regional outlines on the published pages, made at 3296 x 2481 px per page, and they are
stored in that page frame rather than rewritten into the app's: `__VEC__[plate].m` is the
matrix that maps one to the other. Keeping the geometry as the tracer produced it means a
bad registration shows as a wrong matrix, which is six numbers to check, instead of being
baked irreversibly into 9,076 paths.

The tracings are in `svg/`, one file per plate, as they came out of the vectorizer. The
paths the app carries are those with the vectorizer's stray fragments dropped, rounded to
whole page pixels, and they are committed with the fitted matrices in `data/vec.json`;
the matrices alone are copied into `plate_registration` in the database, where a test
keeps the two equal. The pass that selected the paths and fitted the matrices is described
here and not held as code, so `data/vec.json` is one of the assets `tools/README.md`
lists as committed rather than regenerated.

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
appear many more times. 6,322 individual labels are located, covering 3,339 of the
3,510 structure-plate entries (95%). These drive the circling, the hover tooltips and
click-to-select in the HTML app and can be reused for annotation overlays elsewhere.

The labels were read twice. The first pass OCR'd 300 dpi renders with Tesseract and
located 4,164 labels. The second pass re-read all 62 plates from the lossless 300 dpi
PNGs embedded in the source PDF, using a recognizer built for this one typeface:
11,985 labeled glyph exemplars harvested from the first pass, matched as
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
grayscale patch out of a plate that carries it, and slide it over the plate that does not,
scoring normalized cross-correlation over the whole page by FFT. Correlation rather than
pixel overlap, because the halftone ground and half a pixel of set-off put binary agreement
between two impressions of the same word at 0.6, which is where the wrong words are too.

**The score filters; it does not decide.** It cannot tell a word from the same word inside a
longer one, and for a short abbreviation that is the whole difficulty: `sol` is printed
inside `5Sol`, `Cu` inside `9a,bCb`, `I` inside `LaV`. Widening the template's white margin
so a neighboring letter falls into it does not separate them — at every margin tried, a
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

### Where the name is not the place

A label is not always on the thing it names. Where a region is small, or crowded, or lies
against the edge of the section, the atlas cannot fit the word inside it: it sets the name
outside and draws a thin line from the word back into the region. `VMHSh` on plate 30 is
printed clear of the brain altogether, with its line running back up into the shell of the
ventromedial nucleus. **233 of the 6,322 located labels are set that way, on 47 of the 62
plates.** For those the box says where the word is and not where the structure is, and the
two are a median 0.56 mm apart, a sixth of them over a millimeter.

That gap is not a rounding error anywhere downstream. A seed dropped on the word lands on
the far side of a boundary, so the extraction below hands the region to whichever name the
word happens to fall in and the two swap territories. The stereotaxic center the app quotes
is the center of a piece of white paper beside the section. The track planner aims at it.

`tools/label_leaders.py` reads the line off the page and records where it ends, as
`label_leaders` in the JSON and `window.__LEAD__` in the app, keyed to the box it belongs
to. It reads no letters either. A leader is the only thing on the page that is all three of:
ink the tracing did not draw, straight over its whole length, and running out of a located
label. So the ink is thresholded as the label passes threshold it, but **not** denoised —
`denoise` wants two orthogonal neighbors and a two-pixel diagonal rule has none, so it
deletes exactly what this is looking for. Subtract the tracing in `svg/`; subtract the
printed labels, meaning the located boxes and the gap between two words the atlas set as one
label, so that the slash of `Cg1/ RSD` or of `LhbL/M` goes with them. What is left is
leaders and the printed frame. Keep the connected pieces that are long, thin and straight —
a leader crosses the anatomy it points into, and the tracing is cut out with a 2 px skirt,
so one line arrives as two or three pieces. Run each piece backwards along its own
direction, across drawn ink and across the white space the atlas leaves between a word and
its line, and see whether it reaches a box. The far end, marched the same way, is the tip.

**Two labels can reach the same line and only one of them printed it**, and that is the
whole difficulty. On plate 30 the line `VMHC` draws into the ventromedial core stops four
pixels under the last letter of `VMHDM`: read from `VMHC` it leaves the side of a word, read
from `VMHDM` it leaves the bottom edge three pixels shy of the corner, and there is nothing
else in the picture to separate the two readings. A leader is drawn out of the side of a
word far more often than out from under it, so where two labels can claim one line the
sideways reading wins. That settles most of them and not all, so — as with the words the
passes missed — the shape tests propose and the page disposes: **all 229 lines were put
beside the printed plate and read**, and the ten that turned out to be somebody else's line
are listed in the tool with what they were. Nine of the ten are one failure: a line drawn
past a label on its way somewhere else, close enough and straight enough to be that label's.
Two more were dropped for pointing outside the section, which a leader never does. 215
survive, and every one of them was seen on the plate. Those 215 lines answer for 233
boxes: where the atlas typesets several names as one label — `E/OV` on the olfactory
bulb plates — the line is drawn from the whole label, so it is recorded against every
name in it. Only one box can be the one the march reached, and without that the other
kept the printed position and seeded itself where the word is set, which for a label
printed beside its section is not a near miss but another region entirely.

The box stays what it was. It is where the word is printed, so it is still what the app hit
tests when you hover, and `window.__BOX__` is unchanged. What moves is the *position*: the
seed the extraction drops, the coordinate the app quotes, the point the planner aims at, and
the circle it draws when there is no extent to outline — a circle round the word would be a
circle round blank paper beside the section.

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
ventricle counts as brain. One component is kept that the rule drops: on plate 36 the
atlas draws the mammillary body clear of the rest of the section, and at 1,628 px
against a 2% floor of 5,131 it was culled — and with it `ML`, which is printed inside
it, so the structure had no area on the one plate of its three that separates it.
It is traced by the same steps and kept as a second polygon. Across the 62 plates
exactly two components the rule drops carry a printed name; the other is `och` on
plate 22, still dropped. The boundary of each surviving component is traced and
simplified by Douglas-Peucker at 2 px — 35 µm, well inside the atlas's own error — giving
82 polygons over the 62 plates, 8,827 points in all.

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
| Printed labels inside their own plate's outline | — | **98.8%** (6,244 of 6,322) |

Of the 78 labels that fall outside, the largest group is on the olfactory bulb plates 5–9,
where the section is small and the drawing prints the labels beside it; the median one is
0.10 mm out, and the 90th percentile 0.22 mm.

## Region extents

`label_positions` says where an abbreviation is *printed*. `region_extents` says what it
*names*: the area of each structure on each plate, as a list of closed polygons of `[x, y]`
fractions of the frame-cropped image — the same frame and the same convention
`brain_outline` uses, so the app's existing point-in-polygon test reads them unchanged.
**3,066 structure-plate entries carry an area**, 96% of the 3,204 the label pass located
and 91% of the 3,365 the published index lists — both counted over the structures that are
regions — as 5,880 polygons over 166,837 points. Where
the atlas prints two names as one label the two share an entry, so a name having no entry of
its own does not mean it has no area — see step 8. Twenty of the 723 names have no entry
anywhere, and never could: they name no region — see step 7.

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
   abbreviation is that structure's area *as drawn*, and that is 3,477 of the faces. A label
   the atlas set outside its region is seeded at the end of the line it draws rather than on
   the word — see [Where the name is not the place](#where-the-name-is-not-the-place). 212
   labels are, and seeding those on the word puts them in a neighbor's face.
5. **Letter the hemisphere the atlas did not.** The atlas prints most abbreviations twice,
   once per hemisphere, but not all of them: `S1J` on plate 19, `MPtA` on 28, `LPtA` on 29
   are set once, and the sealed face on the other side is then a hole in the section that
   answers to nothing — which is what a reader sees as a region the app will not name. The
   drawing is symmetric about ML 0, so every seed is mirrored across it, and a mirror is
   kept only where two things hold: it lands in a face the tracing seals and *no printed
   abbreviation names*, so what the page says always wins and nothing here can rename
   anything; and that face really is the mirror of the ones the seeds came from, at least
   half of it reflecting into them, which a face merely opposite a named one does not do.
   The second test is against all of those faces together, because the drawing need not
   seal the two hemispheres the same way: where one side draws the boundary between two
   structures and the other does not, one unnamed face answers two named ones, and it is
   then seeded from both and split like any other. **121 seeds** are added this way and they carry no weight of their own: `n`
   counts printed labels, and a mirror exists only where a printed label does.
6. **Split the rest.** Where a face holds several abbreviations, ink is missing somewhere on
   the boundary between them. A watershed seeded on the printed labels and ridged on the
   distance transform of the ink splits the face along the strongest evidence there is. The
   drawn lines themselves belong to no face and are in play, so the split falls down the
   middle of the printed line, where a boundary between two regions ought to fall.
7. **Take back the ground held by the names that are no region.** Not everything the atlas
   letters is a structure with a territory. A fissure or a sulcus is the cleft *between*
   two regions and is drawn as the line between them; `cbw` is the white matter core of
   whichever lobule it runs through rather than a lobule beside them; a vessel is not
   brain. `features` names the twenty, and step 6 hands each of them the ground on both
   sides of a line that is a boundary rather than a region. `cbw` alone held **170 mm²** of
   cerebellum, which left `Crus2` a wedge of its own lobule and, on plate 54, `PM` nothing
   but its label box. So it is given back — **184 mm² over 297 printed labels** — each
   pixel of it to whichever region is nearest measured around the atlas's own lines: flat
   away from them and a step up on them, so the boundary lands on a line wherever one is
   drawn, and past the tip of a fissure, where the atlas draws nothing because there the
   two lobules really are continuous, on the midline between them. The step is on the same
   sealed network the faces were cut from rather than on the raw ink, so a region the
   drawing closes cannot be nearest to ground outside it through a gap in the tracing.
   They are seeded in step 6 and emptied here rather than left out of the watershed
   altogether: the flood runs deepest-first, so with no seed in the depth of the white
   matter the lobule whose label happens to sit deepest takes the whole arbor and the
   vermis with it. What the seed must not do is keep the ground, which is the lobule's.
8. **Leave the unnamed faces alone.** A face holding no label is not absorbed by a
   neighbor. The atlas seals it and declines to name it, and the largest such class is the
   ventricles; calling a ventricle `CPu` would propagate into every readout downstream.
   These are written out separately as `region_extents.unassigned`, and they are a mean 6%
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

9. **Score each polygon** by the share of its border lying within 3 px of ink the tracing
   *actually drew*, as opposed to a ridge the watershed invented, walked at one pixel so it
   is length-weighted.
10. **Take the pixel-wide burrs off the partition, then trace and simplify on the crack
    lattice**, Douglas-Peucker at 0.5 plate px — 9 µm, and a pixel and a half of the page
    the boundary is traced on.

**Step 10 is not the obvious thing, and the obvious thing is wrong.** Contouring each region
on its own and simplifying its ring gives two different polylines for the same shared
boundary, because Douglas-Peucker is global to the ring it is handed; at any useful tolerance
they cross, and the regions then overlap and leave slivers. So the boundary is traced on the
lattice *between* pixels, where both neighbors see the identical chain of corners, and it
is cut at the corners where three or more regions meet — a purely local test, so both sides
cut in the same places. Each arc is simplified once. Douglas-Peucker keeps its endpoints and
is symmetric under reversal, so the two owners of an arc keep the same vertices although
they walk it in opposite directions.

**Sharing a boundary exactly is not the same as it being drawable, which is the other half
of the step.** The watershed settles a boundary to the pixel and at that scale it leaves
burrs: a pixel-wide tongue of one region running along the edge of another, a pixel-wide
sliver of a third lying inside a fourth, a pixel the two meet at diagonally. As area they
are nothing — a third of a plate pixel across, under the width of the atlas's own line —
but Douglas-Peucker keeps whatever lies far from the chord, and the tip of a twenty-pixel
tongue is far from it however thin the tongue. What came out was a polygon with a spike on
it, running out along the boundary and back over itself: **9% of polygons crossed their own
outline**, and 2,722 vertices were repeats of the one before them, with nothing between.
So the burrs come off first. A pixel is thin when no 2×2 block of its own label contains it
— the one local test that passes a staircase, which every boundary here is, and fails a
sliver — and thin pixels go to the nearest label that is not. That is a relabeling and not a
cut: the map is still a partition of the same ground, so the regions still tile it and both
owners of a boundary still trace the same chain of corners. That alone takes the crossings
to **0.7% of polygons** and the repeated vertices to none.

**And the tolerance is 0.5 plate px rather than the 2 px `brain_outline` uses**, which is
the difference between a polygon that reads as the line the atlas drew and one that visibly
cuts its corners. The floor is the page lattice: at 0.35 px the tolerance drops below the
raster step and the polygon starts recording the staircase rather than the line, at seven
times the points. At 0.5 it does not — 166,837 points against the 77,453 the 2 px pass
wrote, for a median traced share of **1.00** where it was 0.98, and it takes the last of the
crossings with it: **0.03% of polygons**, two of 7,048, against 9% before either change.
A thin structure is what a coarse tolerance cannot draw without folding its two sides
together, so most of what was left after the burrs came off was that.

Three checks, none of which the extraction was tuned to pass:

| Check | Extracted |
| --- | --- |
| Every boundary between two regions stored as one polyline, twice | **100%** of directed boundary edges have their reverse in exactly one neighbor, so the regions tile the section — a point is inside exactly one, or inside none |
| Printed labels inside the region they name | **97%**, read at the end of the label's line where the atlas draws one |
| Regions plus unassigned faces against the section area | within **2.4%** on the worst plate (an earlier figure of 4.5% omitted the closing edge of the outline rings, which `brain_outline` stores unclosed) |

**What the numbers do not say is which boundaries are real, so every polygon carries that
too.** `s` is the traced share of that polygon's border: median **1.00**, 81% at or above
0.90, 90% at or above 0.75, **3% below 0.50**. A polygon at 0.98 is the boundary the atlas
prints. A polygon at 0.16 is a split the extraction had to invent because the drawing does
not separate those structures, and it should be read as an estimate — the app dashes those
outlines and says so rather than presenting them as drawn. The weak ones are where a reader
would expect them: `7Cb` on plate 51, `RRF` on 39, `imvc` on 29, the facial subnuclei
`7DM`, `7DI` and `7VI` on 48–50 — thin cerebellar, reticular and motor subdivisions the
pages bound with faint or dashed print, if at all. Step 7 took this figure down from 6% of
polygons to 3%: a lobule cut back to a wedge of itself by `cbw` was mostly boundary the
extraction had invented, and it is now mostly the fissure line the atlas draws.

**And 294 entries have no boundary of their own at all, which `w` says outright.** A face
carrying several abbreviations was split in step 6, and that split is one of two quite
different things. Either the atlas *does* print the boundary and the tracing missed it —
two faces merged through a gap, the ridge on the distance transform found the ink again,
and the split sits on a line somebody drew: `CPu` on plate 25 shares its face and keeps a
rim 98% drawn. Or the atlas prints nothing between those names anywhere, as it does not
between two cerebellar lobules where the fissure line between them runs out, and the split
is the extraction's invention end to end. The whole outline does not tell them apart, because a
structure can have a drawn rim and an invented inner wall. So the split itself is measured:
the share of the wall the watershed put *inside* a face that lands on traced ink. Below
half, nobody drew it — and an entry that sits only in faces like that, and whose own border
is under three-quarters drawn, carries `w`. That is the cerebellar lobules against each
other, the mediodorsal thalamus, the lateral hypothalamic zones, and little else: **294 of
3,066 entries**, against 1,551 that share a face at all. It used to be 372: 63 left, 3
arrived, and 18 more left when step 10 was tightened — a polygon that tracks the ink to half
a pixel has more of its border *on* the ink, so an entry whose own border was just under
three-quarters drawn crosses the line. The 63 are lobules — with `cbw` out of the way in step 7, a lobule's outline is the
fissure lines the atlas draws rather than a split against the white matter inside it. Two of
the three are the far side of splitting a compound label: `9aCb` and `9N` are named only
inside `9a,bCb` and `9/11N`, so each now seeds a face it shares with its neighbors and takes
a `w` where before it had no entry at all — and where the name it shares the label with,
`9bCb` and `11N`, keeps none of its own. The third is `pyx` on plate 62, seeded from its word
once the line it seemed to carry was put aside — see [Where the name is not the
place](#where-the-name-is-not-the-place) — and the word sits in a face it shares. The app draws
no outline for the ones that remain. It highlights every place
the name is printed instead, which is the whole of what the plate says about where the
structure is, and a dashed outline would still read as a boundary this atlas does not have.
The geometry is kept and still partitions the section, because a track and a volume have to
be read off something; it is a best guess at where one name gives way to the next, and not a
boundary to show anyone.

**`w` is not the same claim as being no region at all, and the two are encoded apart on
purpose.** Both end in no outline being drawn, which is the whole of what they share. A `w`
entry *has* ground: `Crus2` on plate 52 is 7.57 mm² of section, with a mesh, a volume and a
share of every track read through it — what it lacks is a boundary of its own to draw there.
A name that is no region has no ground anywhere, so it has no entry in `region_extents` at
all, no area, no volume and no mesh. Collapsing the second into the first would give `cbw`
back the 170 mm² of cerebellum step 7 exists to take off it. Plate 52 carries one of each,
and `tests/js/smoke.spec.js` tests them separately for that reason.

End to end, in the app: pointing at each of the 6,322 printed labels in turn resolves to a
structure every time, and to the name pointed at 6,297 times. **5,346 of them are answered
with an outline.** 549 are answered with the printed name because the entry carries `w` and
there is no boundary to draw, and 423 because there is no extent to give — 297 of those being
the names that are no region, which is not a shortfall but the point of step 7, and the other
126 structures no extent could be cut for. Of the 18 that answer with another name, four are
places where one located box sits inside another (`StA` around `STMA` on plate 23, `PVP`
around `VL` on 29, `psf` around `sf` on 53, `SolC` around `sol` on 55) and the smaller of the
two wins the point, which is the right tie-break everywhere else; the other fourteen are the
compound labels — `9a,bCb`, `9/11N`, `3/4Cb`, `S1J/BF`, `RSGb/c` — where two names hold the
one box and the first answers for both, with the region they share.

233 of the 6,322 printed labels are set outside their region with a line drawn back into
it, and are seeded at the end of that line. A further 192 sit outside the face they name
with no line this pass could follow — printed on a boundary, or beside the section on a line
the tracing runs along — and are pulled to the largest face within a millimeter; most of
those are on the olfactory bulb plates 5–9, where the section is small and the drawing sets
the abbreviations beside it. Following the lines took that fallback down from 262. Two
labels could not be resolved at all and have no extent.

`qc/chk_regions_NN.png` overlays the result on the plate for five levels, tinted green where
the boundary is drawn and red where it is inferred, which is the check a reader can make by
eye and the one that catches a leak the medians average away.

**Where step 7 over-reaches is `IntDL` on plate 47**, which goes from 0.57 mm² to 3.70. The
atlas draws the dorsolateral hump as an open crescent rather than a closed blob, so it
genuinely borders the medullary body and takes a geometric share of it once `cbw` gives that
ground up. Nothing measurable separates it from a lobule doing the same thing: the drawn
share of its frontier with the vacated ground is 0.10, against 0.04 to 0.42 for the lobules
on that plate. The entry carries `w`, so no outline is drawn for it, but its mesh is wider at
that plane than the hump is. It is the only entry that moves that way. Everywhere else the
step does what it says: the lobules gain between 1.5× and 2.9× — `Crus1` 45.9 to 72.9 mm²,
`Crus2` 16.7 to 29.4, `PM` 8.4 to 19.7 — no region loses ground anywhere, the section area is
preserved, and outside the cerebellum nothing changes by more than 0.25 mm².

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
thumb: **the boundaries are already vectorized in `svg/`**, so a candidate lying on a traced
path is a boundary, and that is said rather than guessed. That rules out five would-be joins
— `Sc/Po` on 32, `Or/Py` on 34, `Oca/icp` on 49, `ts/pyx` and `12N/12GH` on 57 — each of
which is two labels with a drawn line between them.

It also costs one true join, and that one is recorded in the tool rather than dropped: on
plate 49 the slash of `PM/ Cop` is drawn along the very boundary it names, and at every
threshold that keeps it, two of those five come back. Every one of the 31 occurrences was
checked against the printed page by eye.

### Coloring the section

The extents tile the plate, which is what lets the app color it the way a map of countries
is colored: fill every region, and give no two regions that touch the same color. Where a
map of countries and a stack of coronal sections part company is that there are 62 of these
and a structure runs through many of them, so the coloring is a question about the atlas
rather than about a plate. Asked plate by plate it has 62 answers: a region bordering three
things on one level and five on the next takes whatever was free on each, half the section
repaints as you step, and the color just learned as `CPu` belongs to something else a plate
later. Asked once over all 62 plates together it has one answer, and that is what is stored:
`region_colors`, a palette slot per abbreviation, held wherever that abbreviation is drawn.
`tools/build_region_colors.py` is the derivation; the app carries the result and paints it.

**Neighbors are read off the vertices, and then off the gaps.** Every boundary between two
regions is one polyline held twice, once in each, vertex for vertex, so two regions that
share a boundary share its vertices: index the vertices and the regions filed under each one
touch there, with no tolerance and no intersection test. That is sound because the extents
are a clean planar subdivision, which the extraction checks and which holds over all 62
plates: every stored edge belongs to one region or to two and never to three. Sharing a
*point* is used rather than sharing an *edge*, deliberately — two regions that meet at a
single corner would read as one patch if they were painted alike.

The vertex test answers for boundaries the two regions hold in common and for nothing else,
and a boundary can be missed by a hair without being shared. **Two regions that come within
0.05 mm of each other — 2.9 px of the 1100 × 703 frame, about a pixel and a half on screen
at the zoom the plate opens at — are counted as touching too.** Over the atlas 4,434 pairs
of names touch on at least one plate; 4,187 of them share a vertex somewhere and 247 never
do, meeting only across a gap under the tolerance — 526 plate-by-plate occurrences, on all
62 plates. Those are laminae one or two pixels wide (`Py` between `Or` and `Rad` on plate
30), near-corners where two boundaries pass within a fifth of a pixel without meeting, and
pinches. **62 of the 247 would be painted alike on the vertex test alone**, and would then
have read as one region across a gap nobody can see. Folding them in costs nothing: with the
rule and without it, the atlas needs the same eight colors.

**The atlas is what decides where a color may change.** Some entries lie inside one boundary
the atlas draws round several names and print nothing within — the `w` flag, above — and a
color change through the middle of those draws a line the atlas does not have. So pairs like
that are joined into one patch and painted as one. What makes this a decision rather than a
rule is that `w` is read off each plate's own ink: **87 of the 189 pairs that share an
unprinted border somewhere are drawn apart by a printed line somewhere else**, and one color
cannot be both. The printed line wins every time. Merging such a pair would erase a boundary
the atlas draws; splitting it draws a color change where the atlas prints nothing, which is
the milder error and the honest one, since the color change is then telling the truth about
the other plate. So the candidates are the 102 pairs with no printed boundary anywhere, and
even those only as far as they can be taken without a printed boundary falling *inside* a
patch along a chain of merges: **74 joins hold, 28 are refused**, and the 688 regions of the
atlas become 631 patches, the largest of them seven names.

**The patches are colored with eight colors, which is the fewest.** Eight regions of this
atlas pairwise touch — cortical layers 1, 2 and 3 against `Pir`, `Tu`, `ICj`, `VP` and `AHA`
— so seven cannot be enough, and eight is found, so eight is exactly enough. It is reached
by peeling: strip every patch with fewer than eight neighbors off the graph until none is
left, color what remains by tabu search from a DSATUR start, and put the peeled ones back in
the reverse of the order they came off, where a slot is always free for them. The search is
seeded, so a re-run reproduces the block byte for byte, and `--check` says whether the
committed one is current. Which of the eight slots a patch takes is settled last and changes
no boundary: every region asks for the slot hashed from its abbreviation, and the assignment
granting the most asks — 117 of the 688 — is the one taken.

**Eight is what holding a color still costs.** A plate on its own needs four colors on 10 of
the 62, five on 45 and six on 7; under the atlas-wide solve 4 plates carry six colors, one
carries seven and 57 carry all eight. That is a slightly busier picture per plate, bought
against the whole section repainting at every step, and the trade is not close.

Two things are still not painted. The sealed faces the atlas names nothing inside
(`unassigned`, above) have no region to color. And a patch is one color across the whole of
it, however many names the atlas has set inside the one printed outline. What that paints is
what the plate prints: one patch per printed boundary.

The block records all of it — the joins, the 28 refusals by name, the patch every region
belongs to, and the slot it wears. `tests/python/test_data.py` re-derives the adjacency from
the committed extents and checks the two things that matter: that no two regions touching on
any plate wear the same slot, and that no pair sharing a patch is ever drawn apart by a
printed line. The browser tests check the same invariant from the page's own geometry on
seven plates, and that a region's color never moves as the plate steps.

## Gross divisions

The atlas names 723 structures and no containers for them. Its Index of structures is flat:
there is no "hippocampus" in it, only CA1, CA2, CA3, DG and their layers, and no "pons",
only the pontine nuclei, the reticular nuclei, the parabrachial nuclei and the rest. Asking
for a whole division is a thing people want to do and the published data cannot answer.

`tools/build_groups.py` adds twenty of them. **A division is a list of the atlas's own
abbreviations and nothing else.** It carries no geometry, no coordinate and no boundary of
its own; everything it shows is derived, in the app, from its members:

| what it shows | where it comes from |
| --- | --- |
| its outline on a plate | its members' outlines, with the boundaries they share with each other dropped |
| its area on a plate | the sum of its members' own areas, the numbers `region_extents` already carries |
| its label center and spread | the median and range of its members' printed labels |
| its mesh | its members' meshes, drawn together |
| the plates it is on | where its members are, clipped to its own range where it has one |

So a division can be wrong about *what belongs in it* — that is a judgement, and the point of
writing the members out — but it cannot invent a line the atlas does not draw.

The **outline** is exact rather than approximate, and for a reason particular to this data.
The region extents tile the section: every boundary between two regions is one polyline
stored twice, once in each, and every boundary with the outside is stored once
(`region_extents.summary.boundary_edges_shared_exactly` is 1.0, and
`tests/python/test_data.py::test_shared_edges_recomputed` recomputes it). Count the edges of
a division's members and drop the ones that came up twice, and what is left is exactly the
outer boundary of the union: a wall between two members cancels, a wall between a member and
something outside the division does not. The survivors are then walked into closed rings —
every vertex of a region boundary has even degree, so the walk always closes. Nothing is
unioned numerically, nothing is smoothed, and every edge of the result is an edge the atlas
drew. `test_group_outlines_close` runs the cancellation over all 451 division–plate pairs;
the browser test samples points and checks that the ring encloses the same ground the members
do.

### What is in each, and why

Divisions **overlap on purpose**. The brainstem is exactly the midbrain, pons and medulla
together; the olfactory bulb sits inside the olfactory areas; frontal, parietal, temporal and
occipital cortex sit inside the cerebral cortex; a structure that straddles the pons and the
medulla is in both. So this is a covering, not a partition, and the areas of two divisions do
not add.

Most divisions start from the atlas's own system tags, which are already close to
anatomical containers for some of them (`hippocampal`, `olfactory`, `amygdala`, `cerebellum`,
`fiber_tract`) and not for others. The corrections are stated as rules rather than as a hand
list, and each is in the tool beside the division it applies to. Three are worth naming here:

- **The `thalamus` tag over-applies.** Thirty-three hypothalamic nuclei carry it as well as
  `hypothalamus`; the thalamus division is the tag minus anything tagged hypothalamic.
- **`cortex` is a false friend twice over.** The dorsal and external *cortices of the
  inferior colliculus* carry it and are not cerebral cortex; they are filed under midbrain
  alone. Conversely most cortical fields are tagged by function (`auditory`, `visual`) rather
  than by place, which is why the four lobes are explicit lists.
- **The `brainstem` tag is not the brainstem.** It is the pontine and medullary reticular
  core; it holds no midbrain and not the cranial nerve nuclei. The brainstem division is
  built from the three divisions under it instead.

The **pons against the medulla** is the one boundary the atlas's own geometry can settle, so
it is drawn off the plates rather than asserted: the pons runs from the first plate that
prints the pontine nuclei to the last that prints the facial nucleus — plates 39 to 49,
bregma −5.50 to −9.35 mm — and the medulla from there to the end of the series. A structure
is swept into one of them if more than one plate of it falls inside, or at least half of it
does. The first clause keeps a long forebrain tract out: the forceps major reaches plate 39
and is no more pontine for it. The second keeps a straddler in both: the deep dorsal cochlear
nucleus is on plates 49 and 50, so it is pontine and medullary at once, which is what it is.

A division's **plate range** is where its gray matter is, not where its members reach. The
medial lemniscus is part of the pons where it runs through it and part of nothing at plate 30,
so tracts are still outlined with a division on its own plates but do not extend it. Divisions
made only of tracts — the fiber tracts, which run the length of the series — are the exception
and take their members' range.

**Six structures are in no division**: `acer` and `mcer`, the anterior and middle cerebral
arteries, `BV`, a blood vessel, and `rf`, `ri` and `hif`, the rhinal fissure, rhinal incisure
and hippocampal fissure. Two of those fissures carry a `cerebellum` tag they should not; that
is a mis-tag in the system layer, worked around here rather than silently propagated. Nothing
else may fall out: the tool exits with an error if the set of ungrouped structures changes,
so a rule that stops matching is a failure rather than a quiet hole.

The divisions are **not part of the published atlas**, exactly as the system tags are not.
`data/gerbil_atlas_groups.csv` writes every member of every division out flat so the
taxonomy can be read and disagreed with without opening the JSON or the Python, and CI runs
`tools/build_groups.py --check` so the committed block is always what the rules produce.

## The third dimension

> **Experimental.** These volumes interpolate across the section gap, which every other
> derivation here refuses to do. Read the next two paragraphs before using them for
> anything you would have to defend.

`brain_outline` and `region_extents` are 62 coronal drawings and nothing between them. The
app's own `plateAt()` says so in as many words — *nothing interpolates between plates: the
outlines are 350 µm apart and an interpolated surface would be arithmetic, not anatomy* —
and quantizes an AP to the nearest section rather than blending two.
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
   millimeters with the same `plate_frame` formulae the app uses. The fill is **even-odd
   across all of a structure's rings together**, which is exactly `regIn()` in the app: the
   two hemispheres union, a hole subtracts, and no winding order has to be kept right.
2. **Lay AP out so every plate lands exactly on a sample** — plate *k* at index 4 + 7*k*. A
   plate's own drawing is then never resampled, so the whole of the interpolation is in the
   six planes between two plates and none of it is anywhere else.
3. **Interpolate the signed distance field, not the contour.** Each mask's signed distance
   is blended between neighboring plates and thresholded at zero. This is the choice that
   carries the result: the section outline splits and rejoins along the series — the
   hemispheres part on plates 10–14, cortex from midbrain on 37–42, cerebellum from
   brainstem on 56–59 — and a scheme that pairs contours between plates has nothing to pair
   across a split. A distance field needs no correspondence at all.
4. **Let every structure compete in the same plane.** Interpolating each structure on its
   own would let neighbors overlap and leave voids in the gap, throwing away the one
   property `region_extents` worked hardest for. So every structure on a plate, together
   with the unassigned faces the atlas seals and declines to name, is blended into the same
   intermediate plane and each voxel goes to whichever field is highest. **The regions
   partition the volume exactly as they partition a section**, and a ventricle stays a
   ventricle rather than being absorbed by whatever borders it.
5. **Close a run's ends rather than extruding them.** Where a structure is drawn on one of
   two neighboring plates and not the other, its field is tapered out from the plate that
   has it until it is negative everywhere, half a section step beyond. It is *not* blended
   with the absent plate: that side's field is a large negative constant and averaging with
   it would swamp the taper and end the structure flat at the plate.
6. **Bridge a hole in a plate run only where the published index says there should not be
   one.** 44 structure-plate holes are filled that way, as extraction misses; the rest are
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
| `surface` | At least three consecutive plates. The mesh follows the drawn boundaries, interpolated between them. | 433 |
| `slab` | One or two plates. The series does not sample the structure along AP at all, so the mesh is a **convex hull per connected component** — a claim about where the structure is, not about what shape it is — closed half a section step beyond the plates that name it. | 264 |

A `slab` is what "circumscribed" means here and is marked `bounding: true`. Unlike the
`surface` meshes, two slabs may overlap: a bounding volume is not a partition. The hull is
taken per connected component and never over all of them at once, because one hull around a
bilateral pair would span the midline and claim the brain in between — on a test pair that
is a tenfold overclaim.

Each entry carries its plate runs, its volume and its connected components. **Nothing is cut
at ML 0 on principle.** A bilateral structure comes out as two components and a midline one
as a single component spanning the midline, which is the honest way round: the drawings are
not perfectly symmetric — plates 43 and 44 sit about a millimeter off center — so cutting
every structure at ML 0 would invent a midline the atlas does not draw. The centers bear
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
filaments the argument predicts — and it costs 45 printed labels their place inside the
surface, taking containment from 98.8% to 98.1%. Some of those 45 sat on a spur and belong
outside; which ones cannot be told from here. Left off, the surface contains **98.8%** of
the printed labels against the **97.8%** the 2-D outline reports. So the geometry is left honest,
as the 2-D extraction left it, and the opening is a flag.

### Checks

The interpolation cannot be checked against anything, because there is nothing to check it
against. What can be checked is that it did not move the plates, and that the 2-D
extraction's own guarantees survived into three dimensions.

| Check | 2-D | Extracted in 3-D |
| --- | --- | --- |
| Cross-section area on a plate a structure was built from, against `region_extents` | — | **median 1.4% off**, 90th percentile 6.7% — the lattice's own quantisation |
| Regions partition the volume | a point is inside one region or none | **holds**: every voxel inside the surface carries exactly one label, or is an unnamed sealed face — 4.2% of the brain |
| Highest point of the surface | DV −0.06 | **DV −0.10** (one voxel) |
| Lowest point of the surface | DV −9.09 | **DV −9.05** |
| Printed labels inside the surface | 97.8% | **98.8%** |
| Printed labels inside the region they name | 97% | **93.1%** — the 2-D figure is after 199 labels were pulled to the nearest face; this one is not |
| Brain volume | not published | **1,046 mm³** |

Two costs are worth stating because they are larger than the interpolation is likely to be.
Reading the distance field coarsely costs a mesh a median **4.1%** of its volume; an
isosurface sitting half a voxel inside the voxels it was cut from accounts for another
**4.9%**, which is not an error but the difference between a surface and a pile of cubes.

And **74% of structures arrive as the one or two pieces anatomy expects**. Where a thin sheet
pinches off into more — `CA1`, the ventricle slits, `DCl` — a median 16% of it sits outside
the largest two. This is reported rather than closed up: closing it would mean growing a
structure into a neighbor, and the partition is worth more than a tidy component count. The
per-component volumes are in the file, so a reader can drop the scraps.

`qc/chk_vol_NN.png` is the picture a reader can check by eye: a plate, the plane interpolated
halfway to the next, and that next plate, side by side and colored the same way — the
interpolation is either plausible between them or it is not.
`qc/chk_vol_surface.png` and `chk_vol_regions.png` are depth-shaded sagittal, top-down and
coronal views of the whole thing.

**Nothing here is inlined into the app.** The meshes are 21 MB and the app is a single file
you open. The 3-D view fetches `data/gerbil_atlas_volumes.json` on demand instead —
**Meshes** in its controls — when the page is served over HTTP, and offers the file picker
when it was opened from disk; it draws the selected structure, or a filtered list of up to
forty, as closed surfaces, and says which grade each is and that six planes in seven are
interpolated. The **STL** button that wrote the selected mesh out is off the toolbar for
now; the writer behind it is unchanged and `tools/build_volumes.py --stl` writes the same
meshes offline. The label volume the meshes are cut
from is also written out, by `build_volumes.py --nifti`, as `data/gerbil_atlas_labels.nii.gz`:
one uint16 id per 50 µm voxel, the file's axes in RAS order (x to the animal's right, y
anterior, z dorsal) with the atlas millimeters in its sform, and `data/gerbil_atlas_labels_lut.csv`
naming each id; 0 is outside the brain and 65000 a face the atlas seals and does not name.
Its per-structure voxel counts agree with the mesh volumes to within 0.3%. The meshes were regenerated with the
library versions `tools/requirements.txt` pins: the vertices are those of the first build
to the 0.01 mm the file stores, and the triangle order differs, which is what a different
scikit-image does with a tie.


## Your own coordinate frame

> **Experimental.** Frame adjustment is new and not yet fully tested. Check adjusted
> coordinates against anatomy you already know before relying on them.

The atlas is cut **perpendicular to the brainstem axis**, which is not how a head sits in
any particular stereotaxic frame. **Frame** in the header takes a pitch, a roll and a yaw
about a pivot you choose, plus a translation, and restates the structure card, the pointer
readout, the coordinate lookup and the CSV export in that frame — keeping the atlas figure
beside each one, so the two can never be confused. The grid and the measure tool stay in
atlas coordinates and say so while it is on. The projection and the 3-D view are the two
that can do more than disclaim a rotation, and an **In frame** checkbox in the toolbar of
each turns them into it — see *Views in the working frame* below.

```
pitch  about ML, + = nose down          roll  about AP, + = right ear down
yaw    about DV, + = nose to the right
```

Composed yaw, then pitch, then roll, about the pivot. Rotations do not commute, so the
order is part of the definition, though at a few degrees of roll and yaw it is well below
anything readable off a manipulator. Nothing in the atlas records which way a given frame
is tilted, so the app cannot check a sign; the dialog shows what the frame does to a
familiar structure and the sign is confirmed by reading that back against anatomy.

This is worth more than it might look. At 17° of pitch about the atlas origin the 6,322
labels move a **median of 2.20 mm** — `MSO` goes from AP −7.95 / DV −8.30 to AP −10.05 /
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
height  dorsal surface (0, the atlas's own DV zero)
        the landmark's own height, off the skull fit — approximate
```

The three numbers are an **offset from the landmark**, not an absolute coordinate, which is
how a zero that is not quite on a landmark gets said: lambda with an AP offset of −0.50 is
half a millimeter behind lambda. Leave them at 0 and zero is the landmark itself. Internally
the landmark contributes only its AP — the atlas prints one for each of these and neither an
ML nor a height — so on those two axes the offset is the whole story. Bregma is landmark 0
and its AP offset is 0, so a stored frame or a link written before the offset existed reads
back unchanged.

**Height** fills the DV offset in from the fitted skull, and it is what makes the
**interaural line** usable as a zero. That landmark is not a point on the brain or on the
skull: it is the ear-bar axis, and the fit puts it at **DV −9.05** — about 9 mm ventral
to the dorsal plane the atlas measures DV from. Zero on interaural with DV left at 0 and
every depth is out by the whole of that; set the height and the readout becomes ordinary
interaural coordinates, AP behind the ear bars and DV up from them. `MSO` then reads
`interaural −0.70 · ML ±1.31 · DV +0.75` against an atlas `AP −7.95 · DV −8.30`. For
bregma, lambda and the occipital crest the button offers the vault at that AP instead
(−0.22, +0.54, −0.06) — a zero taken on bone rather than on dura.

The AP is the atlas's own and exact; **the height is not**. No height for any of these
landmarks is published, so it comes off the same approximate skull registration the
**Skull** overlays are drawn from, and carries the same asterisk to the same note — good
to a few tenths of a millimeter, before animal-to-animal variation. The button only types
the number into the DV field: it holds no state of its own, so the deep link, the stored
frame and the CSV's `frame_spec` carry it as the plain offset they always did, and a
measured ear-bar depth typed in by hand behaves identically.

Moving zero is not a rotation and is not hedged as one: it moves no point, and every distance
and angle is the one the atlas printed. So with every angle left at 0 the projections rule and
label their axes from the origin, the measure tool needs no caveat, and the header button says
so rather than warning about an approximation that is not being made. Set an angle as well and
the grid and the measure tool fall back to atlas coordinates and say so, as before, while the
projection and the 3-D view offer the **In frame** checkbox described below.

### Views in the working frame

The plate is an image and cannot be reoriented: a coronal drawing at 350 µm spacing has no
oblique cut in it to show. The projection and the 3-D view are different in kind — both draw
points and quads placed from coordinates, so a rotation is something they can be *put into*
rather than only warned about. An **In frame** checkbox appears in the toolbar of each as soon
as a pitch, roll or yaw is set, and one setting drives both: they are two pictures of the same
brain, and a reader who has said which orientation they are working in has not said which panel
they are looking at. It is off by default — the atlas orientation is the one every published
figure is in — and the deep link carries it as `fv=1` only beside a rotation, so no link
written before it existed changes meaning.

What is turned is the rotation and nothing else. `toFrame` is `R(p−C)+A`, which is
`Rp + (A−RC)`: a rotation about the atlas origin followed by a translation. The rotation goes
onto the picture; the translation stays a relabeling of the axes, which is exactly how a
re-zero has always been drawn. Splitting it that way is what keeps an origin at lambda from
sliding the whole cloud five millimeters off the plot, and it makes the single-axis helpers
those views rule their ticks with honest in both cases — with no rotation the split reproduces
the old one-axis `toFrame` to the last decimal place.

In the projection the label cloud is rotated point by point and the axes are widened, in whole
millimeters per end, to hold whatever the rotation pushed past the atlas's own extents; at 17°
of pitch that is most of the cortex, so a view that turned without widening would simply drop
it. The plate guide stops being a vertical rule, because a plate stops being a single AP: it is
drawn as the line where that section's plane cuts the middle of the brain, tilted by exactly
the part of the rotation those two axes can see, and clicking it still lands on its plate —
the click is read back through the rotation at the same depth the line is drawn at.

In the 3-D view the whole scene — the 62-section stack, the 6,322 labels, the CT shell, the
plate ring and any planned track — is held in one world built affinely out of atlas
millimeters, so the turn is a model matrix in front of the camera rather than a rebuild of any
of it, and three transformed basis vectors are the whole of that matrix. It is taken about the
world's own center so the brain turns in place instead of swinging out of shot, and because the
atlas-to-world map has determinant −1 the result is `S R S⁻¹`: still a rotation, so its inverse
is still its transpose, which is what restates the camera in model space for the ray-marcher,
the shell's shading and the picker.

Two things cannot come along, and they are the same thing twice: the skull silhouette on the
projection and the landmark rules beside it. Both are flattened along the axis the view drops,
and the flattening was done at the atlas's angle — the outline of a turned skull is not the
turned outline of a skull, and a landmark whose AP is all the atlas prints stops being a line
once the frame tilts. Their checkboxes go dead while a turned view is on rather than staying
tickable and quietly drawing nothing. The 3-D shell is a real surface and has no such problem:
it turns with everything else.

A turned view is still not a resectioning. It is the same rigid rotation as every number above
it, applied to the same 62 coronal sections — stood up at an angle, not recut.

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
preset sets AP and ML, for the same reason: the atlas prints an AP for every one of these
landmarks and a height for none. The same **Height** row as the origin's sets DV, and
appears once the pivot's AP is on a landmark — matched on AP alone, because the height
belongs to the landmark's plane and a pivot pushed off the midline for a roll is still on
it. That is not a detail for the interaural line, which is usually the one you want —
pitch turns about a mediolateral axis, so that preset is the ear-bar axis only once DV
says how far below the dorsal surface the axis sits. The difference is large: at 17° of
pitch, `MSO` reads AP −10.36 with the pivot left at the interaural AP on the dorsal
surface, and AP −7.72 with the pivot on the fitted ear-bar axis 9.05 mm lower.

Two consequences the app makes visible. A plate stops being a single AP: under pitch the
AP of a point drifts by `sin θ` per millimeter of DV — about 2.5 mm between the top and
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
objection the 3-D view's streaking already carries. An entry AP is therefore quantized at
the section spacing however smooth the drawn line looks.

Two things the panel says rather than hides. The **entry on the flank** — the track went
in through the side of the head, not the top — is found by asking what the dorsal surface
directly above the entry is: more than 0.5 mm of brain above it and the entry is not a
dorsal approach. And a **target outside its own outline**, which is the case for 18 of the
723 structures, whose labels the drawing prints beside the section and points at.

Across all 703 structures that have located labels, at three angle settings each, all
2,109 solves return finite, bounded numbers; 7 return no entry at all, every one of them a
structure whose label center lies outside the section.

### Naming the target: which plate, and how far off the label

The target has always been the median of the structure's printed labels, folded onto the
chosen hemisphere. Two controls narrow that, and both sit on the same side of one line.

**Which plate.** `CA1` is labeled on 20 sections; the median of all 20 labels is a point
somewhere in the middle of the structure, and no experiment aims at it. *Take the label
from* names one plate and takes the median of that section's labels alone. The menu is
built from the plates the abbreviation is actually *printed* on, not the plate range the
structure is listed for — a structure present at a level is not necessarily labeled
there, and only a plate carrying a label can be a plate to read one from. Picking a plate
also turns the viewer to it: the plan is drawn on the plates, and a target taken from
plate 13 read against plate 30 is a picture of a track somewhere else. A pick is dropped
the moment the target changes to a structure not printed on that plate.

**How far off it.** The three *offset* boxes move the aim off the label in millimeters —
0.2 mm dorsal to `VO`, the classic quarter-turn above a structure. With an offset set the
panel prints the label and the target as two rows rather than one: the plan is then a
claim about a point nothing in the atlas is printed at, and the point it was measured from
has to be readable beside it.

**The offset is in atlas millimeters, and it is the only thing in the planner that is.**
It is applied beside the fold and *before* the carry into the working frame, because
naming a target is anatomy: *dorsal* has to mean dorsal in the brain rather than up the
manipulator's own axis, or the same offset would mean something different at every pitch.
Everything downstream — entry, angles, drive — is still the rig's. The boundary between
the two runs exactly through `tgTarget()`. ML is signed by the hemisphere so that
*lateral* is lateral on both sides and the two stay mirror images, which is what the side
toggle already promises.

Both narrowings are affine, so folding label by label still commutes with taking the
median: adding a constant to every point moves the median by that constant, in whichever
frame it is measured. The label median and the target are computed by the same code path
with and without the offset, so the two rows cannot drift apart.

An offset can walk the target off the plate its label was read from, or past either end of
the series. Neither is an error — the first is a perfectly good plan for a point on a
neighboring section — but neither is what the plate menu appears to promise, so the panel
says which happened.

Deep links carry both, appended after the five fields a plan link has always had and only
when they are not the defaults. A plan aiming at the label itself writes the exact link it
wrote before, and a reader that stops at the fifth field reads a new link as the plan
minus its offset rather than as nonsense.

### What the track passes through

The extents give every section a tiling by structure, so a track can be read off them the
way a probe track is read off the histology afterwards. The planner samples the track every
20 µm from the entry down, asks the nearest plate which region holds each sample — outside
the outline, an unnamed face, or a structure — and merges the runs into a list of structures
with the depth each spans from the surface, along the track and in the working frame, the
same length the plan calls the drive. A probe length reads the whole shank rather than the
track to the tip, and says what the tip ends in and how far past or short of the target it
is. The plate marks each crossing with a tick; the notes and the JSON carry the list.

Two limits, both said in the panel. A sample resolves to the nearest 350 µm section, so a
boundary that runs obliquely between two plates lands on whichever plate is nearer; and a
region whose boundary the atlas does not print is an estimate, and the row says so. A
sliver of nothing shorter than 30 µm at either end — the entry sitting on the outline, or
the target on a boundary — is given to its neighbor rather than listed.

### An injection's footprint

A sphere of a given radius about the target, read against the same extents on a lattice
fine enough for about sixteen samples across, each resolved on its nearest plate: the
share of the sphere's volume that falls in each structure, and the share outside the
section. A bolus is not a sphere and does not stop at a boundary, so this says where a
sphere of that volume sits, not where an injection goes. The sphere is drawn cut by the
current plate's plane, as a circle on the projections, and as three rings in the 3-D view.

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
it marks where the abbreviation sits, near but not identical to the structure's center;
and the atlas samples AP in 350 µm steps, which is why the cloud falls into 62
columns — those columns are the plates.

## The 3-D view

The plates are already in one common coordinate frame, so they can simply be stacked
where they belong: each section drawn at its own bregma. The explorer does this three
ways, all from the plate images already on the page — nothing extra is downloaded, and
there is no library.

- **Volume** ray-marches the field through a 3-D texture, and is what a pane opens in.
  The stack of quads below is the honest picture of what the reconstruction is — 62
  sections and the gaps between them — but at the default oblique angle it is 62 cards
  seen nearly edge-on, which is not what somebody who has just clicked *3D* is looking
  for. The march reads the same field and shows the brain as a solid, so that is the
  first sight of it and the other is one button away. A link that names no mode reads as
  this one; `&r=contour` and `&r=points` are what a link now carries to say otherwise.
- **Contours** draws the atlas's own red boundary drawings as a stack. It reads as a
  contour model of the brain because that is exactly what it is.
- **Labels** plots all 6,322 printed abbreviations as a stereotaxic point cloud — the
  projection views with the third axis put back. The `auditory` chip lights the whole
  ascending pathway in one rotatable view.

A selected structure is picked out in blue in every mode, hovering a point names it and
reads its coordinates, clicking one opens its plate, and a ring traces wherever the plate
viewer currently sits. Anterior/posterior clipping cuts the stack to a slab; **Half**
cuts it at the midline. The whole thing is built once, the first time the tab is opened,
in about a second; it needs WebGL 2, and says so plainly if that is missing.

The layers are separable because the plates are not line art: they are Nissl
photomicrographs with a red vector contour overlay printed on top, so isolating the
contour channel is a matter of color, not tracing. A flood fill inward from the border
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

### The tissue curve

A photographed section is mostly pale tissue, and pale tissue is what a stack of 62 of them
turns into fog. **Density** scales the alpha a sample ends up with, which raises the fog
along with everything else; the three controls beside it decide what the sample was worth
before that, which is what pulls one band of tissue out of the rest.

**Floor**, **Ceiling** and **Gamma** window the tissue channel: tissue at or below the floor
counts for nothing, tissue at or above the ceiling counts for all, whatever falls between is
stretched across the full range, and gamma bends that stretch — under 1 lifting faint tissue,
over 1 keeping only the dense. Bringing the ceiling down to the floor leaves a hard threshold,
which is a picture worth having and so is allowed; the dragged one of the pair stops at the
other rather than pushing it, the way the slab's two ends already do.

One curve serves both raster renderers, so a section reads the same whether it is drawn as
one of 62 quads or sampled by a ray, and the shader is the same eight lines in both. The
contour channel is left out of it deliberately: it is a drawn line, already there or absent,
and it is also what picks the color between tissue and accent, so windowing it would
recolor the render rather than stretch it. What the curve does reach on the labeled
drawing is the gray wash behind the contours — a high floor takes it away and leaves the
atlas's own line drawing standing alone in three dimensions.

At floor 0, ceiling 100 and gamma 1 the curve is the identity and the shader skips the
`pow`, so an untouched view costs nothing and draws exactly what it drew before there was
anything to set. A deep link carries all four numbers as `&tf=<density>,<floor>,<ceiling>,<gamma>`
in hundredths, written only when one of them is off its default — so no link written before
this changes meaning — and the note under the view quotes the window whenever one is set,
because a windowed render is a picture of the tissue after something was done to it and the
reader of somebody else's link has no other way of knowing.

### The stack as a NIfTI

The **NIfTI** button is off the 3-D toolbar for now, along with **STL**. What it wrote,
and what the writer behind it still writes, is described here: the stack as a gzipped
NIfTI-1 volume — the
reconstruction itself rather than a picture of it, so it opens in ITK-SNAP, FSLeyes,
Slicer or nibabel and can be resliced, measured, or registered against something else.
The header is the same 348 bytes of struct `tools/volume.py` writes for the label volume,
and the file is laid out the same way: voxels x fastest in (ML, AP, DV) order so it reads
as RAS — x to the animal's right, y anterior, z dorsal — with an sform putting each voxel
center at its atlas millimeters. Across a plate the voxel is the printed coordinate box
divided by the texture, 32.4 µm or a little under two plate pixels; through the stack it
is the plate spacing, 350 µm. That anisotropy is written into the file rather than
resampled away, which is the honest way to hand it on: a reader that interpolates it can
say so, and one that does not is not misled about what was actually sampled.

The labeled drawing writes two volumes, the ink and then the drawn contour, because on it
the red contour is a picture in its own right; a Nissl or myelin stack writes one, because
a photograph has no contour channel at all — it is tissue the whole way through. Nothing
the toolbar sets goes into the file: not the slab, not the midline cut, not the tissue
curve. Those say what is drawn, and this is what they are drawn from. The millimeters are
the atlas's own, from bregma as the plates print it, which is the frame the STL export
writes in too — a re-zero renames coordinates in the app and does not move the sections,
and a file carrying a private origin would be the one thing about it a reader could not
check.

The stack is 24 MB and the view hands its only copy to the GPU, so the export read the 62
plates again rather than the page holding a second copy for the length of every visit
against an export most of them never ran.

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

In the 3-D view none of that flattening applies, so the four are drawn as what they are:
each landmark's coronal plane as a rule up the midline, exact because its AP is; a
three-axis cross on the vault at bregma, lambda and the occipital crest; and the interaural
line as the ear-bar axis itself, run laterally right through the head and out the other
side, with a ring where it passes each canal. The rings are the measured part; where the
bar ends is not, so it is carried past the widest half-width of the fitted skull — read off
the top-down silhouette, ±11.9 mm, plus 1.6 mm of margin — rather than stopping at the
canals at ±10.4, which sit inside the bone and make the axis read as a chord within the
head instead of a bar going into one. Nothing of it is
depth-tested — an ear bar is not hidden by the head it goes into, and a reference plane you
cannot see through the brain is no reference — and **Half** cuts the axis at the midline
with everything else, which the shared line shader leaves to the geometry. The names ride
over the canvas as text so they stay upright and legible while the marks turn with the
brain; seen end-on the four land on top of each other, and the nearer name is the one
written. It belongs to a pane, like the rest of the 3-D toolbar (`&lm=1`, `&lm2=1`), and
unlike the projection's it is not stood down by a working frame: there the AP rules are
lines only because a view has flattened an axis away, while here they are the planes
themselves, turned by the same model matrix as the brain.

Those same heights are what the frame dialog's **Height** buttons offer, so an interaural
origin or pivot inherits this registration's error rather than being silently 9 mm out.

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
bone along its outward ray — measured against the full-resolution scan — is leveled
iteratively, tilting until the clearance no longer trends with AP (slope
0.0004 mm/mm at convergence) and setting the height to a small positive roof gap.
That lands at pitch −21.6° of the scan's long axis. The three axis scales are fitted
separately rather than kept uniform, because the two animals are not the same shape:
AP ×1.032, ML ×1.042, DV ×0.957 relative to the CT's own millimeters. The DV shrink is
what seats the calvaria on the cortex — the scanned skull's vault sits about a
millimeter proud of the atlas animal's brain at the midline — and an atlas-AP stretch
only changes *which* cross-section of the scan lands on each plate, so it never
distorts the ML/DV outline drawn on any one plate. The **lambdoid suture could not be resolved** in
this scan, so lambda is the one printed landmark not independently anchored.

The plates were deliberately given the last word over the landmarks, because the two
disagree by a few tenths of a millimeter and the sections are what the skull is drawn
against. After the tilt is set by the plates, the suture-derived bregma reads
AP +0.5, the ear canals −7.6 against the printed −7.25, and the foramen magnum
center sits 0.5 mm above the cord on the last plates — each within roughly the sum
of its own measurement uncertainty and the skull-shape difference, and stated here
rather than fitted away. The residual that remains in the overlays: this skull's
**posterior fossa runs shallower** relative to its calvaria than the atlas animal's,
so the cerebellar plates still sit closest to the roof (about +0.1 mm median
clearance, against +0.4 over the cerebrum) — a shape difference no rigid fit can
remove. Expect registration error of a few tenths of a millimeter on top of the
animal-to-animal variation that any skull-to-atlas comparison carries.

For the page the mesh is decimated to 70k triangles (0.42 mm vertex clustering, then
interior surfaces that are never visible from outside — turbinates, the inner ear —
dropped), quantized to 0.01 mm and embedded as ~0.75 MB of base64, which is where the
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

The **gross divisions** are the same kind of addition and a larger one — see
[Gross divisions](#gross-divisions). Where a system tag is a label on a structure, a division
is a claim about which structures make a thing, which is why every member of every one of
them is written out in `data/gerbil_atlas_groups.csv`.
