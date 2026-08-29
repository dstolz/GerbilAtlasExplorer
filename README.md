# Gerbil Atlas Explorer

Queryable index of the Radtke-Schuller et al. (2016) Mongolian gerbil brain atlas:
723 structures across 62 coronal plates, with stereotaxic coordinates and the
on-plate position of every printed abbreviation.

## [Use the Gerbil Atlas Explorer](https://dstolz.github.io/GerbilAtlasExplorer/gerbil_atlas_explorer.html)
*note that the tool might miss some brain regions*

## Files

| File | What it is |
| --- | --- |
| `gerbil_atlas_explorer.html` | Self-contained browser app. Open it directly — no server, no internet. Search, filter by system, step through plates, see a selected structure circled on the plate, and hover any printed label to read the structure's full name or click it to select that structure. Also: a sagittal or top-down projection of every label in the atlas, so a structure can be seen whole; a live bregma/ML/DV readout under the pointer; a reverse lookup that names the structures nearest a set of coordinates; a 1 mm grid and scale bar; zoom and pan; a two-point distance and approach-angle measure;
a working coordinate frame (experimental), so coordinates can be read at your own head tilt rather than the atlas's; a 3-D view that stacks the 62 plates where they actually sit, ray-marches them, or plots every label as a point cloud you can orbit; PNG and CSV export; and shareable deep links. All 62 plate images are embedded (~6.1 MB). |
| `gerbil_atlas.json` | Full database: structures, plate coordinates, the plate-frame ML/DV calibration, system tags, aliases, label positions, verification record. |
| `gerbil_atlas_structures.csv` | One row per structure: abbreviation, name, plate range, bregma range, system tags, explicit plate list. |
| `gerbil_atlas_plates.csv` | One row per plate: bregma / lambda / interaural / occipital-crest AP coordinates, structure count. |
| `index_raw.txt` | The authors' published index as extracted, `abbreviation\|name\|plate range`. Source of truth for the rest. |

## Where the data comes from

Structure–plate assignments are taken verbatim from the authors' own **Index of
structures** in the open-access paper, not from OCR of the plates:

> Radtke-Schuller S, Schuller G, Angenstein F, Grosser OS, Goldschmidt J, Budinger E (2016).
> Brain atlas of the Mongolian gerbil (*Meriones unguiculatus*) in CT/MRI-aided stereotaxic
> coordinates. *Brain Struct Funct* 221(Suppl 1):1–272. doi:10.1007/s00429-016-1259-0

## Coordinates

Plate AP coordinates were read from all 62 plates and match the printed series exactly:

```
bregma(plate n)  = 7.80 - 0.35 * (n - 1)      # plate 1 = +7.80 mm, plate 62 = -13.55 mm
lambda           = bregma + 4.45
interaural       = bregma + 7.25
occipital crest  = bregma + 9.95
```

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

With AP coming from the plate, this gives every one of the 6,220 located labels a full
stereotaxic triplet.

## Plate images

Plates are cropped **relative to the printed coordinate frame**, detected per page,
rather than to fixed page fractions. This matters: in the source PDF the plate 31
figure sits 118 px (at 300 dpi) lower on the page than every other plate, and plates 1
and 10 are offset by 2–3 px. Frame-relative cropping puts all 62 images in one
common coordinate frame.

## Label positions

`label_positions` in the JSON records where each abbreviation is printed on each
plate, as `[cx, cy, w, h]` fractions of the frame-cropped image. Most structures
appear twice, once per hemisphere; layered ones such as cerebellar white matter
appear many more times. 6,220 individual labels are located, covering 3,270 of the
3,506 structure-plate entries (93%). These drive the circling, the hover tooltips and
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

This is worth more than it might look. At 17° of pitch about the atlas origin the 6,220
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
        bregma · lambda · interaural · occipital crest · a point of your own
```

Naming an origin makes the pivot irrelevant, and not by choice: `R(P−piv)+piv` minus
`R(O−piv)+piv` is `R(P−O)` for every `piv`, so re-zeroing on a point *is* rotating about it.
The dialog fades the pivot controls and says so. A landmark sets the origin's AP and ML only,
for the same reason a pivot preset does — the atlas prints an AP for each of these and a height
for none — so DV stays yours: 0 zeroes on the brain's dorsal surface, and anything else is the
depth you actually zeroed at. The offset is still applied after the rotation, so it survives.

Every readout that quotes an AP names what it is measured from once an origin is set —
`lambda −5.79 · ML ±1.31 · DV −6.94` rather than a bare `AP` — and the CSV's `frame_spec`
column records `origin=lambda origin_AP/ML/DV=…` in place of the pivot it no longer uses.
Deep links carry it too; links written before the origin existed still load, with no origin.

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
- **Labels** plots all 6,220 printed abbreviations as a stereotaxic point cloud — the
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
and no surface is fitted to those points.

## Caveats

- **System tags** (`auditory`, `hippocampal`, `thalamus`, …) are a convenience layer
  added on top of the published nomenclature. They are not part of the original atlas.
  The `auditory` tag covers the full ascending pathway: cochlear nuclei → superior
  olivary complex → lemniscal nuclei → inferior colliculus → medial geniculate → cortex.
- A structure listed for a plate range is present at those levels, but is **not
  necessarily labelled** on every plate of that range.
- Label positions come from OCR. Where a label was not located, the app says so
  rather than showing nothing. 20 of the 723 structures have no located label at all,
  so they have no coordinate and cannot be projected.
- A stereotaxic coordinate given for a structure is the median of the positions where its
  abbreviation is **printed**, which is near but not identical to the structure's centroid.
  It is a targeting aid, not a substitute for reading the plate.
- `label_positions` holds only structure-plate pairs the published index lists. Six
  abbreviations were found printed one or two plates beyond their published range, and
  are recorded under `verification.known_source_discrepancies` instead: **AngT** on
  plate 29 (index: 28), **ZIC** on 35 (34), **Su3C** on 37 (36), **RLi** on 36 (35),
  **cg** on 35 (17–34), and **Sol** on 52 and 59 (49–50). Each was confirmed by eye on
  the plate. The database follows the published index.
