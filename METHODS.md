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
`data/index_raw.txt` was transcribed from the second and `data/index_structures_raw.txt`
from the first, separately, so that the two could disagree; `tools/check_indexes.py`
compares them.

They agree on all 723 abbreviations, every name and every plate range. Both were almost
certainly set from one master table, so this is not independent confirmation of the atlas,
but it is the only available check that the 723 entries reached this repository intact.
The two differences it reports are typographic: `Bar` differs by an apostrophe, and
`VMHVL`'s name is mangled in the Index of structures text layer.

### Where the index gives itself away

The atlas writes a bare number for a structure on one plate and a range for one on several:
104 entries bare, 612 proper ranges. Seven are written with a dash and no second plate, and
the Index of abbreviations renders three of those as a plain number:

| abbr | printed range | printed on the next plate? |
|---|---|---|
| AngT | `28–28` | yes, plate 29, both hemispheres |
| ZIC  | `34–34` | yes, plate 35, both hemispheres |
| Su3C | `36–36` | yes, plate 37, both hemispheres |
| RLi  | `35–35` | yes, plate 36, one hemisphere |
| CAT  | `43–`   | no |
| IVF  | `25–`   | no |
| MnM  | `34–`   | no |

The four set as `N–N` are exactly the four abbreviations the label pass had found printed
one plate past their published range. Two independent facts singling out the same four
entries is not a coincidence, so the dash is taken at its word and the database reads those
ranges as N to N+1. It is the one place the database departs from the printed index, and
it is recorded in `verification.index_range_corrections`. The other three were checked the
same way: every candidate scoring over 0.55 on the following plate was a different word
(`VEn` and `VP` for `IVF`, `MoDG` for `MnM`, nothing over 0.60 for `CAT` on plates 42, 44
or 45), so they stay at the single plate the Index of abbreviations gives them. The change
restored four printed labels that had been excluded from `label_positions` for falling
outside their published range.

## Coordinates

Plate AP coordinates were read from all 62 plates and match the printed series exactly:

```
bregma(plate n)  = 7.80 - 0.35 * (n - 1)      # plate 1 = +7.80 mm, plate 62 = -13.55 mm
lambda           = bregma + 4.45
interaural       = bregma + 7.25
occipital crest  = bregma + 9.95
```

The three offsets are the skull landmark distances the paper measures by CT (Table 2).
Lambda (4.45 mm) and the interaural line (7.25 mm) are the atlas animal's own. The
occipital crest is not: Table 2 gives the atlas animal 9.98 mm, and the plate headers use
9.95, the median over ten CT scans. The database carries 9.95, since the headers are what a
reader reads off the page; the 0.03 mm is a difference inside the paper, not a
transcription error.

Sections are coronal, perpendicular to the brainstem axis, at 350 µm intervals. DV zero is
the plane through the most dorsal points of cerebrum and cerebellum (negative = ventral);
ML zero is the midsagittal plane.

ML and DV come from each plate's printed coordinate box, which the frame-relative cropping
below makes common to all 62 plates. In the 1100 × 703 frame the ML axis runs −8 to +8 mm
across x = 64 to 976 and the DV axis +1 to −10 mm down y = 39.0 to 663.8. `plate_frame` in
the JSON records the map and the app reads it from there:

```
ML(mm) = (x - 520.0) / 57.0
DV(mm) = (95.81 - y) / 56.80
```

The fit is least-squares over the 1 mm tick lattice printed inside the box, read off all 62
plates: 56.999 ± 0.007 px/mm for ML and 56.798 ± 0.007 for DV, no single tick worse than
0.42 px, plate 31 with its page offset included. Checked against anatomy: midline structures
(`3V`, `Aq`, `4V`, `cc`, `MnR`) land within 0.10 mm of ML 0, and bilateral pairs come out
symmetric at the published widths (`MSO` ±1.33, `LSO` ±1.67, `CIC` ±1.93, `Au1` ±6.48, mean
distance from the midline). With AP from the plate, every one of the 6,349 located labels
has a full stereotaxic triplet.

## Plate images

Plates are cropped **relative to the printed coordinate frame**, detected per page, rather
than to fixed page fractions. In the source PDF the plate 31 figure sits 118 px (at 300 dpi)
lower on the page than every other plate, and plates 1 and 10 are offset by 2–3 px;
frame-relative cropping puts all 62 images in one coordinate frame.

### The three plates of a level

The atlas prints each of the 62 levels three times, on consecutive pages of the
supplement: the Nissl-stained section, the Gallyas myelin-stained section from an adjacent
section, and the labeled drawing traced over them, with a fourth page carrying the level's
abbreviation list and CT/MRI reference. All 186 section pages are in the app, selected
with **Labeled / Nissl / Myelin**.

### The MRI, as a fourth source

`mri_frame` in `data/gerbil_atlas.json` records how the atlas's own reference MRI volume
maps to stereotaxic millimeters, and `tools/build_mri.py` resamples it into the same
1100 × 703 box as the three published plates, writing `data/plates/mri/NN.jpg`. Where those
files are present the app offers **MRI** beside the other three; where they are not, the
button is absent.

The volume is 256 × 256 × 72 at 117 µm in plane. Its slice spacing is not recorded in the
file and was recovered as 350 µm, the atlas's own plate spacing, so `plate = 62 − slice`
falls out rather than being fitted and reproduces all 62 plates' bregma exactly.
`build_mri.py --verify` projects `brain_outline` onto each slice: the median best shift over
all 62 plates is 0.000 mm in DV and ML, with about 0.39 mm of scatter. Slice 18, the only
slice carrying a burned-in mark, is bregma −7.25, the atlas's interaural zero; neither that
nor the plate correspondence was fitted for.

Three things it is not, and the app says all three. It is a **whole head**: skull, scalp,
eye and turbinate are in the picture. It is **coarse**: 117 µm voxels against the 18 µm the
frame is drawn at. And it is the **only source whose registration to the frame was computed
here** rather than published; the other three are registered by construction through the
printed coordinate box.

It is also the only source not inlined into the pages. The MRI is fetched from
`data/plates/mri/` at run time, and the app decides it is there by loading one image. That
keeps an optional download out of the byte-for-byte page check and lets the lean page carry
a fourth source for the cost of a request rather than two megabytes; the single-file bundle
has the MRI only when opened beside a `data/` folder. The images are 8-bit JPEG at
550 × 352, about a third the bytes of the frame's own 1100 × 703, which would buy nothing
at 6.7× coarser voxels. Anything quantitative should go back to the source volume. See
`LICENSE-DATA.md` for the terms.

Registration between the three published plates is by construction. Every page carries the
printed ML/DV box, each page is cropped to *its own* box by the same detector, and nothing
is warped, translated or scaled to match anything else. Three things had to be right, and
each is checked:

- **The box, not a box.** The detector takes the outermost full-length rules. On the
  finished images the box lands within 0.5 px of (10.25, 10.25)–(1031.5, 692.25) on all 186.
- **Which way up.** Plate 5's Nissl (supplement page S40) stores its image rotated by half a
  turn. The box and ticks are nearly symmetric under that rotation, so the cue is content:
  the vertical *dorso-ventral coordinate* caption sits outside the box on the right and
  nothing sits outside it on the left. It is read on the native page before the mapping;
  turning the mapped image instead would land the box 58 px, a full millimeter of ML, off,
  because the box is not centered in the canvas.
- **The mapping.** Re-deriving the 62 labeled plates through the same code reproduces the
  images already in the app pixel for pixel on 61 of 62; plate 61 is out by one pixel in x.

The myelin section is an *adjacent* section, not the same one, and is aligned as the
authors published it. The alternates are stored at 1100 × 703 as grayscale JPEG at quality
65: 5.8 MB of Nissl and 5.1 MB of myelin, taking the single file from 7.3 MB to 18.2 MB.
**Gray** and **Contrast** are a CSS filter on the image, and the same filter string is set
on the canvas the PNG export draws through. The 3-D view builds a volume per source and
stretches the tissue in the renderer instead, since a filter on an `<img>` cannot reach a
3-D texture; see [the tissue curve](#the-tissue-curve). A histology section has no contour
channel, only tissue, so the weight given to the tissue channel differs by source and by
mode: a slice is composited once and needs enough to be seen through 62 of them, while a
ray is composited at 288 samples and goes opaque a fifth of the way in at anything near
that.

## Vectorized outlines

The **SVG** export saves the plate as paths. They are a tracing of the regional outlines on
the published pages, made at 3296 × 2481 px per page, and are stored in that page frame:
`__VEC__[plate].m` is the matrix onto the app's frame. Keeping the geometry as the tracer
produced it means a bad registration shows as a wrong matrix, six numbers to check, rather
than being baked into 9,076 paths.

The tracings are in `svg/`, one file per plate, as they came out of the vectorizer. The
paths the app carries are those with the vectorizer's stray fragments dropped, rounded to
whole page pixels, committed with the fitted matrices in `data/vec.json`; the matrices
alone are copied into `plate_registration`, where a test keeps the two equal. The pass that
selected the paths and fitted the matrices is described here and not held as code, so
`data/vec.json` is one of the assets `tools/README.md` lists as committed rather than
regenerated.

The matrix is **fitted to each plate's own printed ink, not read off the page layout**. The
scale is shared and comes from the 1 mm ticks (142.6 px/mm across ML, 142.2 down DV,
against the plate frame's 57.0 and 56.8, a ratio of 2.502); orientation and offset are
searched per plate over the four right angles and a translation, scored by the distance
from each traced point to the nearest dark pixel of that plate's image. That has to be
per-plate: the journal set page 20 at a quarter turn, and page 31 carries the displaced
figure noted above, 47 px in the plate frame. Result: **worst plate 1.8 px mean, about
0.03 mm; median 0.77 px, 52 of 62 under 1.2 px.** Coordinates are rounded to whole page
pixels, 0.4 px of the plate frame, inside the 0.29 px the tracing deviates from the printed
line. The bundle adds about 1.9 MB to the file.

Only the outlines were traced, not the abbreviations, the axes, the coordinate box or the
histology. An exported sheet is the drawing plus whatever overlays were on, each in its own
named group, with the same caption the PNG carries.

## Label positions

`label_positions` records where each abbreviation is printed on each plate, as
`[cx, cy, w, h]` fractions of the frame-cropped image. Most structures appear twice, once
per hemisphere; layered ones such as cerebellar white matter appear many more times. 6,349
labels are located, covering 3,351 of the 3,514 structure–plate entries (95%): the 3,510
the index lists and four for `SHy`, which it does not; see
[Known discrepancies](#known-discrepancies-with-the-published-index). They drive the
circling, the hover tooltips and click-to-select in the app.

The labels were read twice. The first pass OCR'd 300 dpi renders with Tesseract and located
4,164 labels. The second re-read all 62 plates from the lossless 300 dpi PNGs embedded in
the source PDF with a recognizer built for this one typeface: 11,985 labeled glyph
exemplars harvested from the first pass, matched as baseline-anchored binary templates,
then whole tokens parsed against the 723 published abbreviations by Viterbi segmentation.
Per-character accuracy under leave-one-plate-out validation is 96.4% top-1 and 99.75%
top-3; the vocabulary constraint resolves the rest. Where two abbreviations are
indistinguishable in this font (`Gl`/`GI`, `IPl`/`IPI`, `GlA`/`GiA`) the published plate
ranges break the tie, since those pairs never overlap.

The second pass re-found 96.7% of the first pass's labels and added 2,073 more, including
second-hemisphere labels the first pass caught on one side only. Every reading that
disagreed with an existing record, fell below the confidence floor, or named a structure
the index does not list for that plate was checked against the plate image by eye. That
review superseded 17 first-pass records where the printed text says otherwise (`Cl`→`DCl`,
`Su3`→`Su3C`, `PR`→`PrC`, `ml`→`mlf`, `Rh`→`PRh`, `La`→`LaV`, `A1`→`A11`, `V1`→`V2L`,
`cg`→`Cg1`, `f`→`fr`, `ts`→`rs`, and cortical-layer digits that are really `S1` and `AI`).

### The words the passes missed

Two passes left 236 index entries with no located label, and those are two different
things. A structure listed for a plate range is not necessarily printed on every plate of
it, so some were never on the page. Others were and were missed: `MPtA` is printed twice on
plate 30 in the same type as everywhere else, and the app could say nothing about it.

A third pass, `tools/find_missing_labels.py`, reads no letters. The atlas sets every
abbreviation in one typeface at one size, so a word missed on one plate is a word already
located on another: cut the grayscale patch out of a plate that carries it and slide it
over the plate that does not, scoring normalized cross-correlation over the page by FFT.
Correlation rather than pixel overlap, because the halftone ground and half a pixel of
set-off put binary agreement between two impressions of the same word at 0.6, where the
wrong words are too.

**The score filters; it does not decide.** It cannot tell a word from the same word inside a
longer one: `sol` inside `5Sol`, `Cu` inside `9a,bCb`, `I` inside `LaV`. Widening the
template's white margin does not separate them; at every margin tried a true `VTT` or `Rh`
scores below a false `SHi`. So all 47 candidates were put beside the printed plate and read.
**37 were the word and 23 entries gained one**; the 8 that were not are listed in the tool
with what they turned out to be, so a re-run reproduces the committed data.

**The pass is not idempotent.** Every label it writes becomes a template the next run can
cut from. A fourth pass found `mlf` on plate 44, printed on both sides and the only plate
between 38 and 55 missing it, plus the four abbreviations the index-range correction had
just brought into range: 9 labels over 5 pairs. A fifth pass found nothing, so the run is at
a fixed point. The four `CONFIRM` entries in the tool are the mirror of `REJECT`: candidates
read against the plate and found to be the word while scoring under the threshold. `Su3C` on
plate 37 reads 0.620 where a false `ZID` on plate 33 reaches 0.772, which is why the page
and not the score decides.

Three things hold afterwards, and all three are checked: every located pair is one the
published index lists (0 exceptions); `window.__BOX__` in the app is byte-identical to
`label_positions.data`; and the new boxes sit on ink like the old ones, median coverage
0.274 against 0.300. One of the 37, the single-glyph `I` on plate 23, falls under the 6%
floor, the class 30 existing boxes were already in: `I` and `1` are too thin to survive the
app's downsampled plate.

The later passes, and the handful of labels read by hand, are itemised in
`verification.note` in the JSON: composed templates for the twenty structures no plate
carried a located copy of (`tools/find_unlettered.py`), the elided compound labels
`9a,bCb`, `9/11N` and `3/4Cb` (`tools/find_compounds.py`), the italic `p1PAG` measured off
the drawing, and the second instances of `OV`, `1` and `STLP` that no pass looks for. Six
structures remain with no located label anywhere: `p1Rt` (italic), `Y` (a capital no other
abbreviation contains, so nothing to compose it from), and `SolM`, `SolDL`, `SolV` and
`SolVL`, which are lettered by bare suffix around a single `sol`.

### The word that was not a word

One located box was not a label. Outside the ruled coordinate box are the tick numbers and
two axis captions set sideways up the margins. On plate 22 the rotated `m` of `[mm]` in the
right-hand caption was read as a `3`, which is an abbreviation the atlas prints (layer 3 of
cortex). Its box sat at ML +9.54 mm, 3.4 mm past the edge of a section whose brain reaches
+6.11. The extraction had already refused it as a seed, so it cost no area, but it plotted:
in the 3-D label cloud it hung in mid-air beside the brain, which is where it was noticed.
The box is gone, and the rule it broke is a test over the committed data: every label lies
inside the ruled box, `[10, 10.5, 1032, 692.5]` of the 1100 × 703 frame. The margin is
wide: located labels run 118 to 906 px across and 125 to 608 px down.

### Where the name is not the place

A label is not always on the thing it names. Where a region is small, crowded, or against
the edge of the section, the atlas sets the name outside and draws a thin line from the
word back into the region: `VMHSh` on plate 30 is printed clear of the brain altogether.
**240 of the 6,349 located labels are set that way, on 47 of the 62 plates.** For those the
box says where the word is, not where the structure is, and the two are a median 0.57 mm
apart, a fifth of them over a millimeter. A seed dropped on the word lands in a neighbour's
face, the quoted stereotaxic center is a piece of white paper, and the track planner aims at
it.

`tools/label_leaders.py` reads the line off the page and records where it ends, as
`label_leaders` in the JSON and `window.__LEAD__` in the app, keyed to the box. It reads no
letters either. A leader is the only thing on the page that is all three of: ink the
tracing did not draw, straight over its whole length, and running out of a located label.
So the ink is thresholded as the label passes threshold it but **not** denoised, since
`denoise` deletes exactly the two-pixel diagonal runs a line is made of. The tracing in
`svg/` and the printed labels (the located boxes, and the gap between two words the atlas
set as one label, so that the slash of `Cg1/ RSD` goes with them) are subtracted; what is
left is leaders and the printed frame. The long, thin, straight pieces are kept, and each is
run backwards along its own direction, across drawn ink and across the white space between
a word and its line, to see whether it reaches a box. The far end, marched the same way, is
the tip.

**Two labels can reach the same line and only one of them printed it.** On plate 30 the line
`VMHC` draws into the ventromedial core stops four pixels under the last letter of `VMHDM`,
and nothing in the picture separates the two readings. A leader leaves the side of a word
far more often than the bottom, so the sideways reading wins. That settles most and not all,
so, as with the missed words, **every proposed line was put beside the printed plate and
read**: twelve were rejected as somebody else's line, drawn past the label on its way
somewhere else, and two more dropped for pointing outside the section, which a leader never
does; all are listed in the tool with what they were. Where the atlas typesets several
names as one label (`E/OV` on the olfactory bulb plates) the line is drawn from the whole
label and is recorded against every name in it; only one box can be the one the march
reached, and without that the other name seeds where the word is set, which for a label
printed beside its section is another region entirely.

Four lines were read off the page rather than marched to, and they fail in two ways.

**Two ended where the march could not follow.** The march advances only on ink the tracing
did not draw, so where a leader ends inside a region narrower than twice the skirt the
tracing is subtracted with, the last stretch is masked out with the wall it runs through and
the tip is left on the near side, in the neighbour. The right-hand `E/OV` on plate 5 ends
inside an olfactory ventricle 4 px wide and its seed landed 6.9 px short, in the band around
`aci`; the left-hand `E/OV` on plate 3 is the same failure at 24 px. Marching the leader's
own black ink instead (the lines are black, the drawing red) finds them, but moves 47 of the
tips, four by over 35 px: 47 lines to read against the page before any could be trusted. So
the rule is not taken and the two lines that *were* read sit in `TIP_READ`.

**Two were never proposed.** A piece is kept only if it is long, thin and straight, and a tip
nearer its word than `MINTIP` is read as a mark beside the word, the right reading for a
hyphen or a bracket. The right-hand `E/OV` on plate 3 runs the length of the bulb and every
wall it crosses cuts it into fragments; `lo` on plate 13 draws 15 px, under the floor. Both
are in `TIP_HAND`, read the same way. The same march run against the plate-5 line a reader
had already written into `TIP_READ` lands 0.0001 of the frame from it, which says these
readings are the page's and not the reader's.

**Eight more lines are read off the plate and kept in `seed_overrides` rather than here**,
since `label_leaders` is what the tool reproduces from the page. A row of `seed_overrides`
stands in for the printed box exactly as a tip does, is read after this pass, and wins over
a marched tip. `CeCv` is printed twice on each of plates 59, 60 and 61 with a 10–14 px line
drawn medially into the ground beside the central canal; none of the six words was located
until the composed-template pass added them, and each tip sits 15 px from its word, under
`MINTIP`. `9/11N` on plate 62 has a located box and a 32 px line up into the ventral horn,
cut in two where it crosses the outline it points into; both names of the label take the
one tip. All seven words are printed in a neighbour's ground (`CeCv` in `MdV`, `9/11N` in
`vsc`), which is what a seed on the word would have bought.

The box stays what it was: where the word is printed, what the app hit-tests on hover,
`window.__BOX__` unchanged. What moves is the *position*: the seed, the quoted coordinate,
the point the planner aims at, and the circle drawn when there is no extent.

`tools/leaders.py` reads the block back out, a row per leader with both ends in millimeters
and the region each falls in, needing no PDF. `--shared` is the 21 lines a joined label
shares between two names; `--odd` is the tips that land outside the region their label
names: 26 in a neighbour's ground and 38 in an unassigned face or outline too thin to hold
the point. Five of the 26 are names that are no region (three fissures, a sulcus and an
incisure); the other 21 are tips a row of `seed_overrides` supersedes, and they read as
neighbours *because* they are fixed: the extents no longer follow the mark, so the tip is
left sitting in the region it used to take ground from.

## The brain outline

`brain_outline` gives the outline of the section on each plate: what a track has to cross
to reach a target, the surface the planner measures a depth from, and the wall
`region_extents` is cut inside of. The atlas publishes no brain surface, and the CT skull
that ships here is bone from a different animal, so the outline is taken from the drawings
by `tools/build_brain_outline.py`.

**The rule: the drawn line wherever the atlas draws one along the section edge, the tissue
edge where it draws none.** The first outline was a gray threshold on the page, which made
it the photograph's edge rather than the drawing's: one to six pixels outside the red line
all round, and taking in every printed abbreviation and leader line that touched the
section. `region_extents` closes the tracing against the outline, so each of those was a
face sealed by no line the atlas draws, published as an "unnamed sealed face" and drawn in
the SVG export as a gray blob: 371 over the atlas, letter-shaped where a word sat on the
edge, plus 82 named polygons that reached past the red line to the same edge. An outline
from the tracing alone does not work either, because the atlas leaves the outer line
undrawn in places (the cerebellar flanks on plates 53 and 57, the optic nerve on plate 7)
and a fill from the red ink leaks or loses a tenth of a section there.

Per plate: crop to the printed coordinate box, `[14, 14, 1020, 681]` of the 1100 × 703
frame. A pixel is stain or ink where its smallest channel is below 236, and *not* tissue
where it is neutral (channels within 12 of each other and below 200): the black of the
labels, leaders and frame, which the purple stain and the red line never are. The tracing,
carried onto the plate frame, is in the barrier too, because the drawn line runs on under a
printed word where the page shows only black; the pale trigeminal root on plate 42 would
otherwise flood with paper through its own label. Flood the paper in from the border; what
it does not reach is the section, holes filled, so a ventricle and a word printed inside the
tissue both count as brain. The gray of a glyph's antialiased edge inside a printed label box
is then taken off the solid section, and an opening of radius 1 removes one-pixel hairs;
the cortical sheet on plates 36 and 38 that a radius of 3 would eat is untouched.
Components larger than `max(400 px, 2% of the largest)` are kept, and so is any component
over 400 px carrying a printed label, which keeps the two islands the drawing leaves clear
of the section (the optic chiasm on 22, the mammillary body on 36) by rule. Each component's
boundary is traced, carried into the page frame, and every point within 15 page px (6 plate
px, 0.1 mm) of traced ink is moved onto the nearest ink pixel; the open flanks stay on the
tissue edge. Douglas-Peucker at 1.25 page px, the 0.5 plate px `region_extents` is cut at,
then back to plate fractions: **84 polygons over the 62 plates, 9,264 points, 99.8% of them
on traced ink.** The section area is the drawing's, 1.8% less over the atlas than the
photograph's edge gave, 1.0% to 6.0% on a plate.

**Most plates give one polygon, and the ones that give more do so anatomically.** The
interhemispheric fissure separates the hemispheres on plates 10–14, the cortex parts from
the midbrain on 36–42, the cerebellum from the brainstem on 56–59, and the two islands
stand clear on 22 and 36. A reader that kept only the largest blob would silently lose a
hemisphere.

Three checks, none of which the extraction was tuned to pass:

| Check | The atlas says | Extracted |
| --- | --- | --- |
| Highest point of any outline | DV 0 is the plane through the most dorsal points of cerebrum and cerebellum | **DV −0.06 mm**: reaches it, never crosses it |
| Lowest point of any outline | the deepest printed label sits at DV −9.02 | **DV −9.04 mm**: just below it |
| Printed labels inside their own plate's outline, seeded where the atlas seeds them (the end of a leader line where it draws one, else the word) | — | **96.9%** (6,154 of 6,349) |

Of the 195 outside, 54 are fissure and sulcus names, which the atlas prints in the cleft at
the section edge and which name no region; most of the rest are words straddling the outer
line, a median 0.16 mm out, which `region_extents` seeds from the nearest face within
`SNAP_PX`. Moving the outline onto the drawn line took 25 structure–plate entries to no
area, each a word printed beside the section whose "region" had been the word's own ink on
the photograph's edge (`Mi` on the bulb plates, `LNTB` on 45, `LRtPC` on 57 and 58, `dsc` on
53 and 58), and the unnamed faces on the outline from 371 to 7.

## Region extents

`label_positions` says where an abbreviation is *printed*. `region_extents` says what it
*names*: the area of each structure on each plate, as closed polygons of `[x, y]` fractions
of the frame-cropped image, the convention `brain_outline` uses, so the app's point-in-polygon
test reads them unchanged. **<!-- n:region_extents.summary.structure_plate_entries -->3,090<!-- /n --> structure–plate entries carry an area**, 96% of the 3,216 the
label pass located and 92% of the 3,369 the published index lists (both counted over the
structures that are regions), as <!-- n:region_extents.summary.polygons -->5,828<!-- /n --> polygons over <!-- n:region_extents.summary.points -->155,060<!-- /n --> points.
Where the atlas prints two names as one label the two share an entry (step 8). Twenty of the
724 names have no entry anywhere and never could: they name no region (step 7).

The atlas publishes no segmentation. It publishes a line drawing in which every region is a
cell of a planar subdivision with one abbreviation printed inside it, and both halves are
already here: the lines in `svg/`, the abbreviations in `label_positions`. The steps, run by
`tools/build_region_extents.py`:

1. **Read the traced paths in the page frame they were traced in** (3296 × 2481; 2481 × 3296
   for plate 20, which the journal set at a quarter turn) and flatten the cubics.
2. **Bridge the dangling ends.** The tracing is a nearly connected network: over 1,661 open
   endpoints the median sits **1.9 px** from another path, 94% within 12 px, 99% within 25.
   A boundary that misses by two pixels leaks two regions into one, so each dangling end is
   joined to the nearest point on another path within 20 px (140 µm). This is far gentler
   than a morphological close, which welds shut the thin laminae the drawing does separate.
3. **Close against `brain_outline`**, inverse-transformed into the page frame, and fill it
   for the section interior.
4. **Cut the empty space into faces.** A face sealed by traced ink and holding exactly one
   abbreviation is that structure's area *as drawn*: <!-- n:region_extents.summary.faces_named_by_one_abbreviation -->3,448<!-- /n --> faces. A label the atlas set
   outside its region is seeded at the end of the line it draws rather than on the word
   (<!-- n:region_extents.summary.labels_on_a_leader -->213<!-- /n --> labels; see [Where the name is not the place](#where-the-name-is-not-the-place)).
5. **Letter the hemisphere the atlas did not.** Some abbreviations are set once (`S1J` on
   plate 19, `MPtA` on 28, `LPtA` on 29), and the sealed face on the other side is then a
   hole that answers to nothing. The drawing is symmetric about ML 0, so every seed is
   mirrored, and a mirror is kept only where it lands in a face the tracing seals and *no
   printed abbreviation names*, so the page always wins, and where at least half of that face
   reflects into the faces the seeds came from, which a face merely opposite a named one does
   not do. The second test is against all of those faces together, because one side may draw
   a boundary the other does not. <!-- n:region_extents.summary.labels_mirrored -->115<!-- /n --> seeds are added this way; they carry no weight in
   `n`, which counts printed labels.
6. **Split the rest.** Where a face holds several abbreviations, ink is missing somewhere on
   the boundary between them. A watershed seeded on the labels and ridged on the distance
   transform of the ink splits the face along the strongest evidence there is; the drawn
   lines are in play, so the split falls down the middle of a printed line wherever there is
   one.
7. **Take back the ground held by the names that are no region.** A fissure or sulcus is the
   cleft *between* two regions, drawn as the line between them; `cbw` is the white matter
   core of whichever lobule it runs through; a vessel is not brain. `features` names the
   twenty, and step 6 hands each the ground on both sides of a line that is a boundary rather
   than a region: `cbw` alone had held 170 mm² of cerebellum, leaving `Crus2` a wedge of its
   own lobule and, on plate 54, `PM` nothing but its label box. So it is given back,
   <!-- n:region_extents.summary.mm2_returned_to_the_regions -->171.3<!-- /n --> mm² over <!-- n:region_extents.summary.labels_naming_no_region -->297<!-- /n --> printed labels, each pixel to the nearest region
   measured around the atlas's own lines: flat away from them and a step up on them, so the
   boundary lands on a line wherever one is drawn and, past the tip of a fissure, on the
   midline between the two lobules. The step is on the sealed network the faces were cut from
   rather than on the raw ink, so a closed region cannot be nearest to ground outside it
   through a gap. They are seeded in step 6 and emptied here rather than left out, because
   the flood runs deepest-first and without a seed in the white matter the lobule whose label
   sits deepest would take the whole arbor.
8. **Leave the unnamed faces alone.** A face holding no label is not absorbed by a neighbour:
   the atlas seals it and declines to name it, and the largest such class is the ventricles.
   These are written out as `region_extents.unassigned`, a mean 4% of section area. **And do
   not split a face between two names of one label.** The atlas often names a face with two
   abbreviations typeset into a single label (`S1Tr/ LPtA`, `S2/AuD`, `Au1 (A1)`), which the
   label pass reads as two. Seeded as rivals the watershed invents a ridge down the middle
   and hands each a slab of the other, which is how `A1` came to be a rectangle across
   primary auditory cortex. `label_blocks` says which abbreviations the atlas joined, they
   seed as one, and the app answers for any of them with that label's outline: 27 joins on
   42 plates, over 52 printed occurrences.
9. **Score each polygon** by the share of its border within 3 px of ink the tracing
   *actually drew*, as opposed to a ridge the watershed invented, walked at one pixel so it
   is length-weighted.
10. **Take the pixel-wide burrs off the partition, then trace and simplify on the crack
    lattice**, Douglas-Peucker at 0.5 plate px (9 µm, a pixel and a half of the page).

**Step 10 is not the obvious thing.** Contouring each region on its own and simplifying its
ring gives two different polylines for the same shared boundary, because Douglas-Peucker is
global to the ring it is handed; at any useful tolerance they cross and the regions overlap.
So the boundary is traced on the lattice *between* pixels, where both neighbours see the
identical chain of corners, cut at the corners where three or more regions meet (a purely
local test, so both sides cut in the same places), and each arc is simplified once.
Douglas-Peucker keeps its endpoints and is symmetric under reversal, so the two owners of an
arc keep the same vertices.

The burrs come off first because the watershed settles a boundary to the pixel and leaves
pixel-wide tongues and slivers, nothing as area but far from the chord, so Douglas-Peucker
kept them as spikes: 9% of polygons crossed their own outline and 2,722 vertices were
repeats. A pixel is thin when no 2×2 block of its own label contains it, the one local test
that passes a staircase and fails a sliver, and thin pixels go to the nearest label that is
not. That is a relabeling, not a cut, so the map is still a partition. It took the crossings
to 0.7%; the 0.5 px tolerance, against the 2 px an earlier pass used, took them to two of
7,048 polygons, and the median traced share from 0.98 to 1.00. At 0.35 px the tolerance
drops below the raster step and the polygon starts recording the staircase, at seven times
the points.

Three checks, none of which the extraction was tuned to pass:

| Check | Extracted |
| --- | --- |
| Every boundary between two regions stored as one polyline, twice | **100%** of directed boundary edges have their reverse in exactly one neighbour, so the regions tile the section: a point is inside exactly one, or inside none |
| Printed labels inside the region they name | **<!-- n:region_extents.summary.label_inside_its_own_region -->0.9726<!-- /n -->**, read at the end of the label's line where the atlas draws one |
| Regions plus unassigned faces against the section area | within **<!-- n:region_extents.summary.section_area_residual_worst_plate -->0.007<!-- /n -->** of it on the worst plate |

**Every polygon also says which boundaries are real.** `s` is the traced share of its border:
median <!-- n:region_extents.summary.traced_fraction_median -->0.999<!-- /n -->, a share of <!-- n:region_extents.summary.traced_fraction_ge_90 -->0.8<!-- /n --> at or above 0.90, <!-- n:region_extents.summary.traced_fraction_ge_75 -->0.896<!-- /n --> at or above 0.75,
<!-- n:region_extents.summary.traced_fraction_lt_50 -->0.035<!-- /n --> below 0.50. A polygon at 0.98 is the boundary the atlas prints; one at 0.16 is a split
the extraction had to invent, and the app dashes those outlines. The weak ones are where a
reader would expect them: `7Cb` on plate 51, `RRF` on 39, `imvc` on 29, the facial subnuclei
on 48–50, thin subdivisions the pages bound with faint or dashed print, if at all.

**And <!-- n:region_extents.summary.entries_without_a_drawn_outline -->312<!-- /n --> entries have no boundary of their own, which `w` says outright.** A face carrying
several abbreviations was split in step 6, and that split is one of two things: either the
atlas prints the boundary and the tracing missed it, so the ridge found the ink again (`CPu`
on plate 25 keeps a rim 98% drawn), or the atlas prints nothing between those names anywhere,
as between two cerebellar lobules where the fissure runs out. So the split itself is
measured, as the share of the wall the watershed put *inside* a face that lands on traced
ink. Below half, nobody drew it, and an entry that sits only in faces like that, with its own
border under three-quarters drawn, carries `w`: the cerebellar lobules against each other,
the mediodorsal thalamus, the lateral hypothalamic zones, and little else. The app draws no
outline for those; it highlights every place the name is printed instead. The geometry is
kept and still partitions the section, because a track and a volume have to be read off
something, but it is a best guess at where one name gives way to the next.

`w` is not the same claim as being no region. A `w` entry *has* ground (`Crus2` on plate 52
is 7.57 mm² of section, with a mesh and a volume); it lacks a boundary to draw. A name that is
no region has no entry at all. Collapsing the second into the first would give `cbw` back
the cerebellum step 7 exists to take off it. Plate 52 carries one of each, and
`tests/js/smoke.spec.js` tests them separately.

End to end, over the 6,349 printed labels: 5,402 are answered with an outline, 552 with the
printed name because the entry carries `w`, 297 with nothing because the name is no region,
and 98 with nothing because no extent could be cut. Seven labels answer with another name
on purpose, each a word the atlas sets outside the region it names and carried by a seed
placed by hand: the right-hand `S1DZ` on plate 18, below its wedge, in `S1J`; `MA3` on 34 and
35, beside its paramedian column; and both `PN/PIF` labels on plate 36, printed in `PBP`
with a line drawn into the collar around `IF`.

240 of the printed labels carry a line the leader pass read, and <!-- n:region_extents.summary.labels_on_a_leader -->213<!-- /n --> are seeded at
the end of it; the rest are tips a row of `seed_overrides` supersedes, three of them marks the
pass misread (`4Sh` and `4N` on plate 39, `Sp5O` on 51, each printed inside the region it
names). A further <!-- n:region_extents.summary.labels_relocated -->282<!-- /n --> sit outside the face they name with no line to follow, printed on
a boundary or beside the section, and are pulled to the largest face within a millimeter,
most on the olfactory bulb plates 5–9. <!-- n:region_extents.summary.labels_dropped -->0<!-- /n --> could not be resolved.

`qc/chk_regions_NN.png` overlays the result on the plate for five levels, tinted green where
the boundary is drawn and red where it is inferred.

**Where step 7 over-reaches is `IntDL` on plate 47**, 3.68 mm² against the 0.57 mm² the
hump alone is: the atlas draws it as an open crescent rather than a closed blob, so it
genuinely borders the medullary body and takes a geometric share once `cbw` gives that
ground up, and nothing measurable separates it
from a lobule doing the same (drawn share of its frontier with the vacated ground 0.10,
against 0.04 to 0.42 for the lobules on that plate). The entry carries `w`, so no outline is
drawn, but its mesh is wider at that plane than the hump. It is the only entry that moves
that way; elsewhere the step gives the lobules back what the fissures enclose (`Crus1` 72.8
mm² over the series, `Crus2` 29.1, `PM` 19.6), no region loses ground, and outside the
cerebellum nothing changes by more than 0.25 mm².

**This is still not a segmentation.** It is one animal's drawing, cut along the lines that
drawing prints, and where it prints none the split is this extraction's guess.

### Reading the joins

Which abbreviations the atlas typeset together is not in `label_positions` and is not
recoverable from the geometry. What separates two names of one label from two adjacent
labels is the punctuation (a slash between them, a slash ending the line above, a bracket
around the line below), so `tools/label_blocks.py` reads that off the **published page at
2558 × 1708**, where a glyph is 20 px tall rather than the app plate's 8 and a bracket can be
told from an `l`. `label_positions` already says which pixels are letters, so the ink on a
line that no box claims is the punctuation, classified by the path its ink takes: a slash
leans steadily and straight, a bracket bows with its extreme column at the vertical middle.

A drawn boundary through a label is as thin, tall and straight as a slash, and no rule of
thumb separates them; but the boundaries are vectorized in `svg/`, so a candidate lying on a
traced path is a boundary, said rather than guessed. That rules out five would-be joins
(`Sc/Po` on 32, `Or/Py` on 34, `Oca/icp` on 49, `ts/pyx` and `12N/12GH` on 57). It costs one
true join, recorded in the tool: on plate 49 the slash of `PM/ Cop` is drawn along the very
boundary it names. Every occurrence was checked against the printed page by eye.

### Corrections from the plate view

A region that comes out wrong is one of the inputs above being wrong, and the fix is one
edit to an input: a run of boundary added to the tracing (`S1DZ`, plate 19), a seed moved to
the face its label means (`OV`, plate 5; `MA3`, plates 34 and 35; `PN/PIF`, plate 36), a
printed word given the box the label pass had missed (layer 1, plates 17–18; `p1PAG`, plates
32–34), or two where two causes meet on one region, as the `S1DZ` wedge on plate 18 did.
`tools/atlasfix.py`, or `matlab/AtlasRegionFix.m`, is how a reader says it from the plate: a
point inside the region, the run the tracing missed, the outline the region should have,
written to `corrections/<id>.json` in the page frame and pushed. The reader sees what a mark
would do before sending it, with the extraction itself rather than a copy: the face map is
cut by `build_region_extents`'s own rasterizer, and **Recut** applies the draft to a scratch
tree and re-cuts the plate. The published page reads `data/facemaps/` instead, the same cut
of all 62 plates written by `tools/build_facemaps.py` and checked against the tracing on
every push; it cannot re-cut, and says so. A workflow then reads the correction against the
extraction (`tools/corrections.py inspect`), applies it to the input at fault, and re-cuts.
Nothing is drawn into `region_extents` by hand, so the regions still tile and
`boundary_edges_shared_exactly` stays 1.0 by construction.

`seed_overrides` is a seed placed by hand: keyed by plate and abbreviation, a row
`[i, x, y, id, why]` stands in for printed box `i` exactly as a leader tip does, or with
`i = -1` seeds a face beside the printed labels, uncounted in `n` and unmirrored, for a region
the drawing cuts into more faces than the atlas letters it (the zonal layer on plate 39, the
left `RAPir` on plate 28). It is read after `label_leaders`, so it wins over a marched tip,
and it survives a re-run of every pass. A run of boundary goes into the plate's SVG as a path
of cubics with collinear control points, the one grammar the reader accepts, carrying
`data-correction` with the id it came from. A corrected outline is evidence rather than
input: only the runs of it further than 3 px from ink already traced are added.

### Coloring the section

The extents tile the plate, so the app can color it the way a map is colored: every region
filled, no two touching regions alike. Asked plate by plate that has 62 answers and half the
section repaints at every step; asked once over all 62 plates it has one, which is what
`region_colors` stores: a palette slot per abbreviation, held wherever it is drawn.
`tools/build_region_colors.py` derives it; the app paints it.

**Neighbours are read off the vertices, then off the gaps.** Every shared boundary is one
polyline held twice, vertex for vertex, so two regions that share a boundary share its
vertices: index the vertices and the regions filed under each one touch, with no tolerance
and no intersection test. Sharing a *point* rather than an *edge* is deliberate: two regions
meeting at a single corner would read as one patch if painted alike. A boundary can also be
missed by a hair without being shared, so two regions within 0.05 mm (2.9 px of the frame)
count as touching too: thin laminae (`Py` between `Or` and `Rad` on plate 30), near-corners
and pinches. When the rule was set, 259 of 4,506 touching pairs met only across such a gap
and 59 of them would have been painted alike on the vertex test alone; folding them in
costs nothing, since the atlas needs eight colors either way. Today 4,473 pairs of names
touch on at least one plate.

**The atlas decides where a color may change.** Entries that lie inside one printed
boundary with nothing drawn between them (the `w` flag) would get a line the atlas does not
have if painted apart, so such pairs are joined into one patch. But `w` is read off each
plate's own ink, and 95 of the 198 pairs that share an unprinted border somewhere are drawn
apart by a printed line somewhere else; the printed line wins every time, since a color change
where the atlas prints nothing is the milder error. The remaining 103 pairs are joined as far
as they can be without a printed boundary falling *inside* a patch along a chain of merges:
77 joins hold, <!-- n:region_colors.summary.merges_refused -->26<!-- /n --> are refused, and the <!-- n:region_colors.summary.regions -->688<!-- /n --> regions become <!-- n:region_colors.summary.patches -->631<!-- /n --> patches, the largest of them
seven names.

**Eight colors, which is the fewest.** Eight regions pairwise touch (cortical layers 1, 2 and
3 against `Pir`, `Tu`, `ICj`, `VP` and `AHA`), so seven cannot be enough, and eight is
found. It is reached by peeling every patch with fewer than eight neighbours off the graph,
coloring what remains by tabu search from a DSATUR start, and putting the peeled ones back
in reverse order, where a slot is always free. The search is seeded, so a re-run reproduces
the block byte for byte. Which slot a patch takes is settled last and changes no boundary:
every region asks for the slot hashed from its abbreviation, and the assignment granting
the most asks (114 of the 689) is taken. Restarts kick half to three quarters of the start's
patches to random slots; kicking less found nothing where the DSATUR start sat in a bad
basin, and kicking everything found nothing either. Under the atlas-wide solve 4 plates
carry six colors, 6 seven and 52 all eight, a slightly busier picture per plate than a
plate-by-plate solve, bought against the whole section repainting at every step.

Two things are not painted: the sealed faces the atlas names nothing inside, and the
divisions within a patch, which is one color however many names the atlas set inside the
one printed outline. **The same table colors the meshes**: the 3-D view's *Plate colors*
mode reads `region_colors` and nothing else, so a mesh is the color its outline is on the
plate. What was solved is adjacency *on a plate*; two regions that meet only across the
350 µm between two sections were never asked about and can wear the same color where their
meshes touch. `tests/js/mesh3d.spec.js` checks the mapping region for region.

The block records the joins, the refusals by name, the patch every region belongs to and
the slot it wears. `tests/python/test_data.py` re-derives the adjacency from the committed
extents and checks that no two touching regions wear the same slot and no pair sharing a
patch is drawn apart by a printed line; the browser test checks the page carries the whole
table, one slot per region on every plate it is drawn on.

## Gross divisions

The atlas indexes 723 structures and no containers for them: there is no "hippocampus" in
it, only CA1, CA2, CA3, DG and their layers. `tools/build_groups.py` adds twenty-one.
**A division is a list of the atlas's own abbreviations and nothing else.** It carries no
geometry, coordinate or boundary of its own; everything it shows is derived in the app from
its members:

| what it shows | where it comes from |
| --- | --- |
| its outline on a plate | its members' outlines, with the boundaries they share with each other dropped |
| its area on a plate | the sum of its members' areas |
| its label center and spread | the median and range of its members' printed labels |
| its mesh | its members' meshes, drawn together |
| the plates it is on | where its members are, clipped to its own range where it has one |

So a division can be wrong about *what belongs in it*, which is a judgement, but it cannot
invent a line the atlas does not draw. The outline is exact: every boundary between two
regions is stored twice and every boundary with the outside once
(`boundary_edges_shared_exactly` is 1.0, recomputed by
`tests/python/test_data.py::test_shared_edges_recomputed`), so counting the members' edges
and dropping those that came up twice leaves exactly the outer boundary of the union, which
is walked into closed rings; every vertex has even degree, so the walk always closes.
`test_group_outlines_close` runs the cancellation over all 475 division–plate pairs.

### What is in each, and why

Divisions **overlap on purpose**: the brainstem is the midbrain, pons and medulla together,
the olfactory bulb sits inside the olfactory areas, the four lobes inside the cerebral
cortex, and a structure straddling pons and medulla is in both. It is a covering, not a
partition, and the areas of two divisions do not add.

Most divisions start from the atlas's own system tags, which are close to anatomical
containers for some (`olfactory`, `amygdala`, `cerebellum`, `fiber_tract`) and not others.
The corrections are rules in the tool beside the division they apply to. Four are worth
naming:

- **The `thalamus` tag over-applies.** Thirty-three hypothalamic nuclei carry it; the
  thalamus division is the tag minus anything tagged hypothalamic. It also reaches the
  **lithoid nucleus**, printed on plate 33 alone, whose every neighbour there is midbrain
  (Darkschewitsch, the interstitial nucleus of Cajal, the precommissural nucleus, the
  intermediate gray of the superior colliculus, the magnocellular nucleus of the posterior
  commissure, the p1 periaqueductal gray). It is filed under midbrain.
- **`cortex` is a false friend twice over.** The dorsal and external *cortices of the
  inferior colliculus* carry it and are midbrain. Most cortical fields are tagged by function
  (`auditory`, `visual`) rather than place, which is why the four lobes are explicit lists.
- **The `brainstem` tag is not the brainstem.** It is the pontine and medullary reticular
  core, with no midbrain and no cranial nerve nuclei; the division is built from the three
  divisions under it.
- **The `hippocampal` tag is the hippocampus *and its surroundings*.** Thirty-seven
  structures carry it, and two anatomies are inside it.

The **pons against the medulla** is the one boundary the geometry can settle: the pons runs
from the first plate printing the pontine nuclei to the last printing the facial nucleus,
plates 39 to 49, bregma −5.50 to −9.35 mm, and the medulla from there to the end. A
structure is swept into one if more than one plate of it falls inside, or at least half of
it does; the first clause keeps a long forebrain tract out, the second keeps a straddler
such as the deep dorsal cochlear nucleus (plates 49 and 50) in both.

The **hippocampal formation against the parahippocampal region** is a boundary no geometry
can settle, so it is taken from a named source. The formation is the archipallial cortex:
the cornu ammonis and dentate gyrus with their layers, the subiculum, the indusium griseum
and fasciola cinerea, and the white matter it is built on (alveus, fimbria, fornix, the
hippocampal commissures). The parahippocampal region is the cortex outside it:
presubiculum, parasubiculum and postsubiculum, the entorhinal cortices, the perirhinal and
ectorhinal belt. The line falls where Chauhan et al. (2021) put it: their formation runs to
the subiculum, "continuous with the six-layered neocortex (para-hippocampal gyrus)", and the
entorhinal cortex in that chapter *is* the parahippocampal gyrus. Two things on their list
this atlas does not name: the longitudinal striae, not lettered apart from the indusium
griseum here, and the uncus, which a lissencephalic brain has not got.

> Chauhan P, Jethwa K, Rathawa A, Chauhan G, Mehra S (2021). The Anatomy of the Hippocampus.
> In: Pluta R, editor. *Cerebral Ischemia*. Brisbane: Exon Publications. Chapter 2.
> doi:10.36255/exonpublications.cerebralischemia.2021.hippocampus —
> https://www.ncbi.nlm.nih.gov/books/NBK575732/

Three tagged structures are in neither: the amygdalohippocampal area (amygdala) and the
septohippocampal and septofimbrial nuclei (septum and basal forebrain), transitions into the
formation rather than parts of it. The presubiculum, parasubiculum and postsubiculum are the
one placement the chapter does not make: it names the presubiculum once, as what delimits
CA1 laterally, so they are filed with the parahippocampal region, and the member lists are
written out so it can be put back. This is narrower than the formation in use after Amaral
and Witter, which takes in the entorhinal cortex and the whole subicular complex; the
broader formation is `HIPP` and `PHR` together, less the perirhinal and ectorhinal belt. The
formation is written as the tag *minus the parahippocampal region*, the `less` rule in the
tool, so the two cannot overlap or drop a tagged structure between them;
`test_groups_cover_the_atlas` asserts both. Narrowing it moved its caudal end from plate 42
to 38, bregma −5.15 mm, where the subiculum ends.

A division's **plate range** is where its gray matter is, not where its members reach: the
medial lemniscus is part of the pons where it runs through it and part of nothing at plate
30. Divisions made only of tracts take their members' range.

**Six structures are in no division**: `acer` and `mcer`, the anterior and middle cerebral
arteries, `BV`, a blood vessel, and `rf`, `ri` and `hif`, the rhinal fissure, rhinal incisure
and hippocampal fissure. Two of those fissures carry a `cerebellum` tag they should not,
worked around here rather than propagated. The tool exits with an error if the set of
ungrouped structures changes.

The divisions are **not part of the published atlas**, exactly as the system tags are not.
`data/gerbil_atlas_groups.csv` writes every member of every division out flat, and CI runs
`tools/build_groups.py --check` so the committed block is always what the rules produce.

## The third dimension

> **Experimental.** These volumes interpolate across the section gap, which every other
> derivation here refuses to do. Read the next two paragraphs before using them for
> anything you would have to defend.

`brain_outline` and `region_extents` are 62 coronal drawings and nothing between them; the
app's own `plateAt()` quantizes an AP to the nearest section rather than blending two.
`data/gerbil_atlas_volumes.json` sets that aside on purpose: it stacks the 62 plates and
fills the six planes between each pair at 50 µm, giving **a brain surface and one mesh for
each of the <!-- n:vol:summary.structures -->688<!-- /n --> structures that carry an area**.

**Six planes in seven are arithmetic.** The atlas samples AP twenty times more coarsely than
it samples a section, so what these meshes add along the brain is a linear guess. Where a
structure changes shape inside 350 µm, and thin laminae do, the mesh cannot show it. That is
why this is not a segmentation either.

### How it is built

`tools/build_volumes.py`, from the two datasets above and nothing else.

1. **Rasterize each plate** onto a 0.05 mm lattice, reading the stored fractions into
   millimeters with the same `plate_frame` formulae the app uses. The fill is even-odd across
   all of a structure's rings together, exactly `regIn()` in the app.
2. **Lay AP out so every plate lands exactly on a sample**, plate *k* at index 4 + 7*k*, so a
   plate's own drawing is never resampled and the whole of the interpolation is in the six
   planes between two plates.
3. **Interpolate the signed distance field, not the contour.** Each mask's signed distance is
   blended between neighbouring plates and thresholded at zero. The section outline splits
   and rejoins along the series, and a scheme pairing contours has nothing to pair across a
   split; a distance field needs no correspondence.
4. **Let every structure compete in the same plane.** Every structure on a plate, with the
   unassigned faces, is blended into the same intermediate plane and each voxel goes to
   whichever field is highest, so **the regions partition the volume exactly as they
   partition a section** and a ventricle stays a ventricle.
5. **Close a run's ends rather than extruding them.** Where a structure is drawn on one of two
   neighbouring plates and not the other, its field is tapered out from the plate that has it
   until it is negative everywhere, half a section step beyond; blending with the absent
   plate's large negative field would end the structure flat at the plate instead.
6. **Bridge a hole in a plate run only where the published index says there should not be
   one**: 40 structure–plate holes, filled as extraction misses; the rest are real absences.
7. **Surface it** with marching cubes on the distance field, read every 1–6 voxels depending
   on the structure's size, about ten samples across. Coarsening the *field* rather than
   decimating the *mesh* drops the triangles describing the lattice rather than the
   structure: vertex clustering tuned to the same triangle count costs about the same median
   but two to four times as much in the tail (7.4% median and 39.8% at the 90th percentile,
   against 6.1% and 16.7%).

### Grades

| Grade | What it is | Count |
| --- | --- | --- |
| `surface` | At least three consecutive plates. The mesh follows the drawn boundaries, interpolated between them. | <!-- n:vol:summary.graded_surface -->427<!-- /n --> |
| `slab` | One or two plates. The series does not sample the structure along AP at all, so the mesh is a **convex hull per connected component**, a claim about where the structure is rather than what shape it is, closed half a section step beyond the plates that name it. | <!-- n:vol:summary.graded_slab -->261<!-- /n --> |

A `slab` is marked `bounding: true`, and two slabs may overlap: a bounding volume is not a
partition. The hull is taken per connected component, never over all of them at once, since
one hull round a bilateral pair would claim the brain between them. Each entry carries its
plate runs, volume and connected components. **Nothing is cut at ML 0 on principle**: the
drawings are not perfectly symmetric (plates 43 and 44 sit about a millimeter off center), so
a bilateral structure comes out as two components and a midline one as a single component.
The centers bear this out against the published widths: `Au1` at ML ±6.5 against the atlas's
±6.48, `LSO` at ±1.65 against ±1.67, `3V` and `cbw` single and on the midline.

### The spurs, and why the opening is a flag rather than a step

The section outline follows the drawn line and carries no leader-line spurs, but
`--despur` remains: it opens the volume along **AP alone**, with an element longer than one
section step, which in principle removes anything confined to a single plate and erodes
nothing inside a section. Measured when the outline was still the photograph's edge, it
removed 5.8 mm³, 0.55% of the brain, in 760 pieces spread over 58 plates rather than the
handful of filaments the argument predicts, and cost 45 printed labels their place inside
the surface. It is left off, and the surface contains **<!-- n:vol:checks.labels_inside_the_surface -->0.9693<!-- /n -->** of the printed labels,
the same share the 2-D outline reports.

### Checks

The interpolation cannot be checked against anything. What can be checked is that it did not
move the plates, and that the 2-D extraction's guarantees survived into three dimensions.

| Check | 2-D | Extracted in 3-D |
| --- | --- | --- |
| Cross-section area on a plate a structure was built from, against `region_extents` | — | **median <!-- n:vol:checks.section_area_median_rel_error -->0.0115<!-- /n --> off**, 90th percentile <!-- n:vol:checks.section_area_p90_rel_error -->0.0558<!-- /n -->, the lattice's own quantisation |
| Regions partition the volume | a point is inside one region or none | **holds**: every voxel inside the surface carries exactly one label or is an unnamed sealed face, <!-- n:vol:checks.unnamed_fraction -->0.0183<!-- /n --> of the brain |
| Highest point of the surface | DV −0.06 | **DV <!-- n:vol:checks.dv_highest_mm -->-0.1<!-- /n -->** (one voxel) |
| Lowest point of the surface | DV −9.04 | **DV <!-- n:vol:checks.dv_lowest_mm -->-9.0<!-- /n -->** |
| Printed labels inside the surface | 0.9693 | **<!-- n:vol:checks.labels_inside_the_surface -->0.9693<!-- /n -->** |
| Printed labels inside the region they name | <!-- n:region_extents.summary.label_inside_its_own_region -->0.9726<!-- /n --> | **<!-- n:vol:checks.labels_in_their_own_region -->0.9473<!-- /n -->**: the 2-D figure is after labels were pulled to the nearest face; this one is not |
| Brain volume | not published | **<!-- n:vol:summary.brain_volume_mm3 -->1027.821<!-- /n --> mm³** |

Two costs are larger than the interpolation is likely to be: reading the distance field
coarsely costs a mesh a median <!-- n:vol:checks.coarsening_median_rel_error -->0.041<!-- /n --> of its volume, and an isosurface sitting half a
voxel inside the voxels it was cut from accounts for another <!-- n:vol:checks.mesh_vs_voxel_median_rel_error -->0.0502<!-- /n -->, the difference
between a surface and a pile of cubes. And <!-- n:vol:checks.structures_in_one_or_two_pieces -->0.7878<!-- /n --> of structures arrive as the one or
two pieces anatomy expects; where a thin sheet pinches off into more (`CA1`, the ventricle
slits, `DCl`) a median <!-- n:vol:checks.fragment_share_when_more_median -->0.136<!-- /n --> of it sits outside the largest two. This is reported
rather than closed up, since closing it would grow a structure into a neighbour; the
per-component volumes are in the file.

`qc/chk_vol_NN.png` shows a plate, the plane interpolated halfway to the next, and that next
plate side by side; `qc/chk_vol_surface.png` and `chk_vol_regions.png` are depth-shaded views
of the whole.

**Nothing here is inlined into the app.** The meshes are 20 MB; the 3-D view fetches
`data/gerbil_atlas_volumes.json` on demand (**Meshes** in its controls) when served over HTTP
and offers a file picker when opened from disk, drawing the selected structure or a filtered
list of up to forty as closed surfaces and saying which grade each is. `build_volumes.py
--stl` writes the meshes as STL offline; the toolbar's STL button is off for now. The label
volume the meshes are cut from is written by `build_volumes.py --nifti` as
`data/gerbil_atlas_labels.nii.gz`: one uint16 id per 50 µm voxel in RAS order with the atlas
millimeters in its sform, `data/gerbil_atlas_labels_lut.csv` naming each id, 0 outside the
brain and 65000 a face the atlas seals and does not name. Its per-structure voxel counts
agree with the mesh volumes to within 0.3%. The meshes were regenerated with the library
versions `tools/requirements.txt` pins: the vertices are those of the first build to the
0.01 mm the file stores, and the triangle order differs, which is what a different
scikit-image does with a tie.

## Your own coordinate frame

> **Experimental.** Frame adjustment is new and not yet fully tested. Check adjusted
> coordinates against anatomy you already know before relying on them.

The atlas is cut **perpendicular to the brainstem axis**, which is not how a head sits in a
stereotaxic frame. **Frame** in the header takes a pitch, roll and yaw about a pivot you
choose, plus a translation, and restates the structure card, the pointer readout, the
coordinate lookup and the CSV export in that frame, keeping the atlas figure beside each. The
grid and the measure tool stay in atlas coordinates and say so. The projection and the 3-D
view can be turned into the frame with **In frame**, below.

```
pitch  about ML, + = nose down          roll  about AP, + = right ear down
yaw    about DV, + = nose to the right
```

Composed yaw, then pitch, then roll, about the pivot. Rotations do not commute, so the order
is part of the definition, though at a few degrees of roll and yaw the difference is below
anything readable off a manipulator. Nothing in the atlas records which way a frame is
tilted, so the app cannot check a sign; the dialog shows what the frame does to a familiar
structure. At 17° of pitch about the atlas origin the 6,349 labels move a **median of
2.20 mm** (`MSO` goes from AP −7.95 / DV −8.30 to AP −10.05 / DV −5.64); the displacement
grows with distance from the pivot, so the pivot matters more than the angles.

### Where zero is

By default the readout's zero is wherever the rotation carries the atlas origin, the right
reading if you zeroed the manipulator *before* tilting the head. **Origin** names a landmark
instead: drive to it with the head already in the frame, zero there, and that point reads
0 / 0 / 0 however the head is turned.

```
origin  none (default)   zero follows the atlas origin through the rotation
        bregma · lambda · interaural · occipital crest
        + an AP / ML / DV offset from whichever of those is named
height  dorsal surface (0, the atlas's own DV zero)
        the landmark's own height, off the skull fit — approximate
```

The three numbers are an **offset from the landmark**: lambda with an AP offset of −0.50 is
half a millimeter behind lambda. The landmark contributes only its AP, since the atlas
prints neither an ML nor a height for any of them. Bregma is landmark 0 with offset 0, so a
stored frame or a link written before the offset existed reads back unchanged.

**Height** fills the DV offset from the fitted skull, which is what makes the **interaural
line** usable as a zero: it is the ear-bar axis, not a point on the brain, and the fit puts it
at **DV −9.05**. Zero on interaural with DV left at 0 and every depth is out by the whole of
that; set the height and `MSO` reads `interaural −0.70 · ML ±1.31 · DV +0.75` against an
atlas `AP −7.95 · DV −8.30`. For bregma, lambda and the occipital crest the button offers the
vault at that AP (−0.22, +0.54, −0.06), a zero taken on bone rather than dura. The AP is
exact; **the height is not**: no landmark height is published, so it comes off the same
approximate skull registration the **Skull** overlays use, good to a few tenths of a
millimeter before animal-to-animal variation. The button only types the number into the DV
field, so the deep link, the stored frame and the CSV's `frame_spec` carry it as a plain
offset.

Moving zero is not a rotation: it moves no point, and every distance and angle is the one
the atlas printed. With every angle at 0 the projections rule their axes from the origin
and the measure tool needs no caveat; set an angle as well and the grid and measure tool
fall back to atlas coordinates and say so.

### Views in the working frame

The plate is an image and cannot be reoriented. The projection and the 3-D view draw points
and quads placed from coordinates, so a rotation is something they can be put into: an
**In frame** checkbox appears in each as soon as an angle is set, one setting drives both,
and it is off by default, carried in the deep link as `fv=1` only beside a rotation.

What is turned is the rotation and nothing else. `toFrame` is `R(p−C)+A`, which is
`Rp + (A−RC)`: the rotation goes onto the picture, the translation stays a relabeling of
the axes, which is how a re-zero has always been drawn; it keeps an origin at lambda from
sliding the whole cloud five millimeters off the plot, and with no rotation it reproduces
the old one-axis `toFrame` to the last decimal place. In the projection the label cloud is
rotated point by point and the axes are widened in whole millimeters to hold whatever the
rotation pushed past the atlas's extents; the plate guide becomes the line where that
section's plane cuts the middle of the brain, tilted by the part of the rotation those two
axes can see, and clicking it still lands on its plate. In the 3-D view the whole scene is
held in one world built affinely out of atlas millimeters, so the turn is a model matrix in
front of the camera, taken about the world's own center so the brain turns in place; the
atlas-to-world map has determinant −1, so the result is `S R S⁻¹`, still a rotation, and
its inverse is still its transpose for the ray-marcher, the shading and the picker.

Two things cannot come along: the skull silhouette on the projection and the landmark rules
beside it, both flattened along the axis the view drops at the atlas's angle. The outline of
a turned skull is not the turned outline of a skull, so their checkboxes go dead while a
turned view is on. The 3-D shell is a real surface and turns with everything else. A turned
view is still not a resectioning: the same rigid rotation, applied to the same 62 coronal
sections, stood up at an angle.

Naming an origin makes the pivot irrelevant: `R(P−piv)+piv` minus `R(O−piv)+piv` is
`R(P−O)` for every `piv`, so re-zeroing on a point *is* rotating about it, and the dialog
fades the pivot controls. Every readout that quotes an AP then names what it is measured
from (`lambda −5.79 · ML ±1.31 · DV −6.94`), and the CSV's `frame_spec` records the
landmark, the offset and the atlas coordinate zero landed on. The landmark is matched on
where zero landed rather than on which was picked. Deep links carry it in the flag that used
to be a bare `1` and now holds `1 + the landmark's index`.

Presets put the pivot on **bregma, lambda, the interaural line or the occipital crest**,
reading each offset off the plate table. A preset sets AP and ML, and the same **Height**
row sets DV once the pivot's AP is on a landmark. For the interaural line that is not a
detail: pitch turns about a mediolateral axis, so that preset is the ear-bar axis only once
DV says how far below the dorsal surface it sits. At 17° of pitch `MSO` reads AP −10.36
with the pivot on the dorsal surface at the interaural AP, and AP −7.72 with it on the
fitted ear-bar axis 9.05 mm lower.

Two consequences the app makes visible. Under pitch the AP of a point drifts by `sin θ` per
millimeter of DV, about 2.5 mm between the top and bottom of the brain at 17°, so the
readout gives an AP for the point under the pointer rather than one figure for the plate.
And a coordinate is only foldable to `ML ±x` while the frame keeps the atlas's bilateral
symmetry: pitch does, but roll, yaw and a mediolateral offset do not, and the card then
gives each side separately.

### Angles from measurements

Rather than typing an angle, read two points off the skull with the electrode and let the
slope between them give it:

```
pitch = atan( (DV_posterior − DV_bregma) / AP apart )   + = nose down
roll  = atan( (DV_left      − DV_right ) / ML apart )   + = right ear down
yaw   = atan( (AP_left      − AP_right ) / ML apart )   + = nose right
```

**The three are not equally determined, and the app says so.** The atlas is bilaterally
symmetric, so a roll or yaw measured off symmetric landmarks *is* the deviation from the
atlas. Pitch has no such anchor: the atlas prints an AP for its four landmarks and a height
for none, so a bregma–lambda reading gives the skull's tilt against *flat skull*, not
against the atlas plane, and using it replaces the pitch angle outright.

A longer baseline is proportionally more precise: a 0.1 mm depth error over the 4.45 mm from
bregma to lambda is **1.3°** of pitch, but **0.58°** over the 9.95 mm to the occipital crest.
Read the AP span off the manipulator rather than taking the nominal one: the atlas's 4.45 and
7.25 are separations along *its* AP axis, and a tilted frame sees them foreshortened, about
0.7° low at 17°. The roll and yaw spans have no such problem, because you drive the arm to
them.

It is a rigid rotation of the published numbers and **not** a resectioning: no oblique plate
is drawn, or could honestly be drawn, from a series sampled 350 µm apart. An adjusted
coordinate carries the atlas's own error (a label marks where an abbreviation is *printed*),
your alignment error, and animal-to-animal skull variation.

## Planning a track

> **Experimental.** New, and not yet checked against a track anybody has driven. Read a
> plan against anatomy you already know before relying on it.

*Plan a track* takes a structure, a hemisphere and three approach angles and returns the
entry point, the angles to set on the manipulator, and the distance from the brain surface
to the target, drawn live on the plate, the projections and the 3-D view, and carried in the
link.

### The angles are in your frame, not the atlas's

An angle quoted in atlas coordinates is one nobody can dial into a manipulator, since a head
in a frame is not cut perpendicular to its brainstem. The target is carried into the working
frame by the same `toFrame()` the structure card uses, the track is built there, and
`fromFrame()` puts it back on the plates only for drawing, so the picture is exact in any
frame. With a 17° nose-down pitch and zero on lambda, `MSO` reads `lambda −5.79 · ML +1.31 ·
DV −6.94`, and a track that is *vertical on the manipulator* enters the brain at atlas AP
−10.09 rather than −7.95 and is 7.28 mm long rather than 7.51. Neither number is available
from the plate.

### Three angles, two of which set the direction

```
tilt   about ML,  + drives the tip anterior      (entry behind the target)
roll   about AP,  + drives the tip to the right  (entry left of the target)
yaw    about DV,    turns the heading the other two aim in
```

Composed roll, then tilt, then yaw. **Yaw goes outside the other two on purpose**: a straight
probe spun about its own axis points where it pointed before, so a yaw applied first could
never do anything, which is what the Frame dialog's order (`roll · pitch · yaw`) would have
done. Outside, it re-aims whichever way the tilt and roll point, and is inert only while both
are zero, when the app disables the field. The order differs from the Frame dialog's because
that one turns the animal and this one turns the probe. Two angles span every direction; the
third is kept because a manipulator has three settings. The panel also reports the direction
as a single angle from vertical plus a heading in words, the form to check against the rig.

### Finding the entry

Marched from 22 mm outside the target back along the approach at 20 µm, then refined at 2 µm
inside the step that hit, taking the outermost point that is inside the section **and** has
0.2 mm of brain behind it. A solve costs about **0.9 ms**, so the track redraws on every
keystroke. The surface is the nearest plate's outline, and nothing interpolates between
plates, so an entry AP is quantized at the section spacing.

Two things the panel says rather than hides: an **entry on the flank**, found by asking
whether more than 0.5 mm of brain lies directly above the entry, and a **target outside its
own outline**, the case for structures whose labels the drawing prints beside the section
and points at. When the planner was checked over every structure with a located label (703
at the time) at three angle settings each, all 2,109 solves returned finite, bounded numbers
and 7 returned no entry, every one a structure whose label center lies outside the section.

### Naming the target: which plate, and how far off the label

The target is the median of the structure's printed labels, folded onto the chosen
hemisphere. Two controls narrow that.

**Which plate.** `CA1` is labeled on 20 sections, and no experiment aims at the median of all
20. *Take the label from* names one plate and takes the median of that section's labels
alone. The menu is built from the plates the abbreviation is actually *printed* on, not the
range the structure is listed for, and picking a plate turns the viewer to it. A pick is
dropped the moment the target changes to a structure not printed on that plate.

**How far off it.** The three *offset* boxes move the aim off the label in millimeters, 0.2
mm dorsal to `VO` for instance. With an offset set the panel prints the label and the target
as two rows. **The offset is in atlas millimeters, the only thing in the planner that is**,
applied beside the fold and *before* the carry into the working frame, because naming a
target is anatomy: *dorsal* has to mean dorsal in the brain rather than up the manipulator's
axis. The boundary between the two runs through `tgTarget()`. ML is signed by the
hemisphere so that *lateral* is lateral on both sides. Both narrowings are affine, so
folding label by label still commutes with taking the median, and the two rows are computed
by the same code path. An offset can walk the target off the plate its label was read from
or past either end of the series; neither is an error, and the panel says which happened.
Deep links carry both, appended after the five fields a plan link has always had and only
when they are not the defaults.

### What the track passes through

The extents tile every section, so a track can be read off them the way a probe track is
read off the histology afterwards: sampled every 20 µm from the entry down, each sample
asked of the nearest plate which region holds it (outside the outline, an unnamed face, or a
structure), and the runs merged into a list of structures with the depth each spans, along
the track and in the working frame. A probe length reads the whole shank, and says what the
tip ends in and how far past or short of the target it is. Two limits, both in the panel: a
sample resolves to the nearest 350 µm section, so an oblique boundary lands on whichever
plate is nearer; and a region whose boundary the atlas does not print is an estimate, and
the row says so. A sliver shorter than 30 µm at either end is given to its neighbour.

### An injection's footprint

A sphere of a given radius about the target, read against the same extents on a lattice
fine enough for about sixteen samples across, each resolved on its nearest plate: the share
of the sphere's volume in each structure and outside the section. A bolus is not a sphere
and does not stop at a boundary, so this says where a sphere of that volume sits, not where
an injection goes. It is drawn cut by the current plate's plane, as a circle on the
projections, and as three rings in the 3-D view.

### What it does not do

It plans a **straight track to where an abbreviation is printed**, not to a centroid. It
knows nothing about vasculature, the sinus or the ventricles: the outline is a silhouette,
and a track through a ventricle is drawn no differently. It does not check the entry against
the skull, which would need the skull overlay to be something to measure against. And the
surface is a **fixed, sectioned** brain: the brain sits lower under intact dura, and lower
again once it is opened.

## Projection views

The explorer plots every located label as a point in **AP × DV** (sagittal) or **AP × ML**
(top-down), which a coronal series cannot show: a selected structure is picked out in blue,
so `CA1` visibly sweeps from near the midline out to ML ±5 mm as it runs backwards, and the
`auditory` chip lights the whole ascending pathway. Hovering a point names it; clicking
opens its plate. A point is a *printed label*, near but not identical to the structure's
center, and the cloud falls into 62 columns because those are the plates.

## The 3-D view

The plates are in one coordinate frame, so they can be stacked where they belong, each at
its own bregma. The explorer does this three ways, from the plate images already on the
page, with no download and no library:

- **Volume** ray-marches the field through a 3-D texture, and is what a pane opens in: the
  stack of quads is the honest picture of 62 sections and the gaps between them, but at the
  default oblique angle it is 62 cards seen nearly edge-on. A link that names no mode reads
  as this one; `&r=contour` and `&r=points` say otherwise.
- **Contours** draws the atlas's own red boundary drawings as a stack.
- **Labels** plots all 6,349 printed abbreviations as a stereotaxic point cloud, the
  projection views with the third axis put back.

A selected structure is picked out in blue in every mode, hovering a point names it,
clicking one opens its plate, and a ring traces wherever the plate viewer sits. Clipping
cuts the stack to a slab; **Half** cuts it at the midline. It is built the first time the
tab is opened, in about a second, and needs WebGL 2.

Which of the plate's four sources the stack is read from belongs to the **pane**, so
**Split** can hold a Nissl stack beside a myelin one, the comparison the atlas sets up on
consecutive pages and cannot complete. Both stacks are built in the same coordinate box off
pages the authors registered to each other, so everything drawn over them lands in the same
place in both panes; they are not the same tissue twice, since the myelin page is an adjacent
section. The GPU holds one texture per staining a drawn pane is on, at 24 MB apiece; a
staining no drawn pane is on is handed back. A link names A's staining as `&ps3=` and B's as
`&ps32=`, each written only where it differs from what the link already implies.

The layers are separable because the plates are Nissl photomicrographs with a red vector
contour overlay printed on top, so isolating the contour channel is a matter of color, not
tracing. A flood fill inward from the border drops everything outside the section, which
keeps the plate number and the coordinate table out of the volume.

Two limits, and the app states them too. Sections are 350 µm apart while a plate pixel is
about 17.5 µm, so sampling *along* the brain is 20× coarser than across it: the streaking in
the volume view is interpolation between slices, not anatomy. And a label point marks where
an abbreviation is *printed*; most structures carry only a handful (six is the median), so a
single structure reads as a sparse arc. **None of this is a segmentation**, and no surface
is fitted to those points; the surfaces that exist are the offline ones in
[The third dimension](#the-third-dimension), and the app does not carry them.

### The tissue curve

A photographed section is mostly pale tissue, and a stack of 62 of them turns into fog.
**Density** scales the alpha a sample ends up with, which raises the fog with everything
else; **Floor**, **Ceiling** and **Gamma** window the tissue channel first, which is what
pulls one band of tissue out of the rest: tissue at or below the floor counts for nothing,
at or above the ceiling for all, and gamma bends the stretch between (under 1 lifting faint
tissue, over 1 keeping only the dense). Bringing the ceiling down to the floor leaves a hard
threshold, which is allowed; the dragged one of the pair stops at the other.

One curve serves both raster renderers, so a section reads the same whether drawn as one of
62 quads or sampled by a ray. The contour channel is left out of it: it is a drawn line,
already there or absent, and it picks the color between tissue and accent, so windowing it
would recolor the render. What the curve does reach on the labeled drawing is the gray wash
behind the contours; a high floor takes it away and leaves the line drawing standing alone
in three dimensions. At floor 0, ceiling 100 and gamma 1 the curve is the identity and the
shader skips the `pow`. A deep link carries the four as `&tf=<density>,<floor>,<ceiling>,<gamma>`
in hundredths, written only when one is off its default, and the note under the view quotes
the window whenever one is set.

### The stack as a NIfTI

The **NIfTI** button is off the 3-D toolbar for now, with **STL**. What the writer behind it
still writes is the stack as a gzipped NIfTI-1 volume, the reconstruction itself rather than
a picture of it, so it opens in ITK-SNAP, FSLeyes, Slicer or nibabel. The header is the
same 348 bytes `tools/volume.py` writes for the label volume, laid out the same way: voxels
x fastest in (ML, AP, DV) order so it reads as RAS, with an sform putting each voxel center
at its atlas millimeters. Across a plate the voxel is the printed coordinate box divided by
the texture, 32.4 µm; through the stack it is the plate spacing, 350 µm. That anisotropy is
written into the file rather than resampled away, so a reader is not misled about what was
sampled. The labeled drawing writes two volumes, the ink and the drawn contour; a Nissl or
myelin stack writes one. Nothing the toolbar sets goes into the file, and the millimeters
are the atlas's own from bregma, the frame the STL export writes in too. A stack is 24 MB
and the view hands its only copy to the GPU, so the export reads the 62 plates again rather
than the page holding a second copy.

### The skull

> **Experimental.** The skull overlay and its registration are new and not yet fully
> tested. Treat it as context around the stack, not a surface to measure against.

The skull shows in three places, all off by default. **Skull** in the 3-D controls wraps the
stack in a translucent shell whose opacity the **Bone** slider sets, with **Half** cutting
bone and brain at the same midline. **Skull** in the plate controls traces the surface's cut
through the current coronal plane over the plate (sliced in the browser, once per plate; the
PNG export carries the trace). **Skull** in the projection controls draws the silhouette
around the label cloud, flattened along the unplotted axis as the labels are. Deep links
carry all three (`&sk=<opacity>` for the shell; `k` and `K` among the `&v=` flags).

**Landmarks** rides on the same registration. The atlas prints an AP for bregma, lambda, the
interaural line and the occipital crest and a height for none, so the AP rules are exact and
drawn whatever the skull says, while the marker heights (the vault at each landmark's AP)
and the ear canals the interaural line runs between (ML ±10.4, DV −9.1, putting bregma
8.8 mm above the ear-bar plane) are read off the fitted mesh. A point landmark is drawn only
on the plate whose plane it falls in; the interaural line is solid in its own plane, a
dashed height reference elsewhere, a point end-on in the sagittal projection and a line in
the top-down one. In the 3-D view the four are drawn as what they are: each landmark's
coronal plane as a rule up the midline, a three-axis cross on the vault at bregma, lambda
and the occipital crest, and the interaural line as the ear-bar axis run laterally through
the head and out the other side, with a ring where it passes each canal and carried past
the widest half-width of the fitted skull (±11.9 mm plus 1.6 mm of margin) so it reads as a
bar going into a head rather than a chord within one. None of it is depth-tested, **Half**
cuts the axis at the midline, and the names ride over the canvas as text so they stay
legible. It belongs to a pane (`&lm=1`, `&lm2=1`) and, unlike the projection's, is not stood
down by a working frame: here the AP rules are the planes themselves, turned by the same
model matrix as the brain. Those same heights are what the frame dialog's **Height** buttons
offer, so an interaural origin inherits this registration's error rather than being silently
9 mm out.

The source is a µCT surface of a gerbil skull (`GerbilSkull.stl`, 498k triangles as
scanned), a different animal from the atlas's, in scanner coordinates. The atlas prints no
skull surface, so the registration follows the paper's own recipe: bregma, lambda and the
occipital crest defined by intersecting lines approximating the sutures, an AP printed for
each landmark (bregma 0, lambda −4.45, interaural −7.25, occipital crest −9.95), and the
atlas leveled on the plane through the most dorsal points of cerebrum and cerebellum.

The fit uses those features found on the scan, then refines against the plates. The scan's
bilateral symmetry fixes the midline (it lay rolled −13.6° in scanner axes; residual yaw
0.1°). The **coronal suture** is visible as a groove chevron in a high-pass-filtered height
map of the vault; extrapolating its arms to the midline gives bregma, constrained to AP 0.
The two **ear-canal openings** are constrained to the interaural line at AP −7.25, the
**occipital crest** weakly to −9.95. Tilt and height are then set by the drawn sections of
all 62 plates: the signed clearance from each dorsal-arc boundary point to the first bone
along its outward ray, measured against the full-resolution scan, is leveled iteratively
until it no longer trends with AP (slope 0.0004 mm/mm at convergence), with the height set
to a small positive roof gap. That lands at pitch −21.6° of the scan's long axis. The three
axis scales are fitted separately, since the two animals are not the same shape: AP ×1.032,
ML ×1.042, DV ×0.957 relative to the CT's millimeters. The DV shrink seats the calvaria on
the cortex, the scanned vault sitting about a millimeter proud of the atlas animal's brain;
an AP stretch only changes which cross-section of the scan lands on each plate and never
distorts the ML/DV outline on any one. The **lambdoid suture could not be resolved**, so
lambda is the one printed landmark not independently anchored.

The plates were given the last word over the landmarks, because the two disagree by a few
tenths of a millimeter and the sections are what the skull is drawn against. After the tilt
is set by the plates, the suture-derived bregma reads AP +0.5, the ear canals −7.6 against
the printed −7.25, and the foramen magnum center sits 0.5 mm above the cord on the last
plates, each within roughly the sum of its measurement uncertainty and the skull-shape
difference. What remains is a shape difference no rigid fit can remove: this skull's
posterior fossa runs shallower relative to its calvaria than the atlas animal's, so the
cerebellar plates sit closest to the roof (about +0.1 mm median clearance, against +0.4 over
the cerebrum). Expect registration error of a few tenths of a millimeter on top of
animal-to-animal variation.

For the page the mesh is decimated to 70k triangles (0.42 mm vertex clustering, then
interior surfaces never visible from outside dropped), quantized to 0.01 mm and embedded as
about 0.75 MB of base64; the projection silhouettes ride along as a few kilobytes of
polylines. Nothing is decoded until a skull control is first turned on.

## Known discrepancies with the published index

`label_positions` holds only structure–plate pairs the published index lists, with one
exception. Two abbreviations are printed beyond their published range with nothing in the
index's own typography to justify extending it, and are recorded under
`verification.known_source_discrepancies` instead: **cg** on plate 35 (index: 17–34) and
**Sol** on 52 and 59 (49–50). Both were confirmed by eye on the plate; the database follows
the published index. `Sol` in particular is printed inside longer abbreviations that *are*
listed at those levels (`5Sol` on 52, `SolM` and `SolC` on 59), so what is printed there may
not be `Sol` at all.

**`SHy` is the exception.** The septohypothalamic nucleus is printed on plates 22 to 25,
once per hemisphere on 22, 23 and 25 and twice on 24, and *neither* printed index carries a
row for it: both run `SFi` to `SHi` to `Sim`. The glyph was read at 16× against the label
face to rule out a Greek gamma, and neither raw transcription contains a non-ASCII
abbreviation, so the omission is the paper's. Following the index would mean dropping a
structure the atlas draws, names and letters ten times over, so `SHy` is carried with the
range read off the plates, the one structure the database holds that the index does not
list, and `verification.index_entries_checked` stays 3,510. Its labels were found by the
composed-template pass, read against the printed page, and its extents follow: 0.39, 1.03,
0.36 and 1.76 mm² over the four plates, the last carrying `w` because plate 25 prints the
name without drawing a boundary for it. The four abbreviations whose published range is
malformed are handled above, under
[Where the index gives itself away](#where-the-index-gives-itself-away).

System tags (`auditory`, `hippocampal`, `thalamus`, …) are a convenience layer on top of the
published nomenclature and not part of the atlas; the `auditory` tag covers the full
ascending pathway from cochlear nuclei to cortex. The **gross divisions** are the same kind
of addition and a larger one, see [Gross divisions](#gross-divisions), which is why every
member of every one of them is written out in `data/gerbil_atlas_groups.csv`.
