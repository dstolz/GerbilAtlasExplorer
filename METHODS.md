# Methods and provenance

Technical detail behind the [Gerbil Atlas Explorer](README.md): where the data comes
from, how coordinates were calibrated, how the labels were read, and what was checked.

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

### The three plates of a level

The atlas prints each of the 62 levels three times — the Nissl-stained section, the
Gallyas myelin-stained section from an adjacent section, and the labelled drawing traced
over them — on consecutive pages of the supplement, with a fourth page carrying that
level's abbreviation list and its CT/MRI reference. All 186 section pages are in the app,
selected with **Labelled / Nissl / Myelin**.

Registration between them is by construction rather than by fitting. Every page carries
the atlas's own printed ML/DV box, and each page is cropped to *its own* box by the same
detector, so all three land in the coordinate frame above — the frame the 6,220 label
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

`label_positions` holds only structure-plate pairs the published index lists. Six
abbreviations were found printed one or two plates beyond their published range, and
are recorded under `verification.known_source_discrepancies` instead: **AngT** on
plate 29 (index: 28), **ZIC** on 35 (34), **Su3C** on 37 (36), **RLi** on 36 (35),
**cg** on 35 (17–34), and **Sol** on 52 and 59 (49–50). Each was confirmed by eye on
the plate. The database follows the published index.

System tags (`auditory`, `hippocampal`, `thalamus`, …) are a convenience layer added on
top of the published nomenclature and are not part of the original atlas. The `auditory`
tag covers the full ascending pathway: cochlear nuclei → superior olivary complex →
lemniscal nuclei → inferior colliculus → medial geniculate → cortex.
