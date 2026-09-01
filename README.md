# Gerbil Atlas Explorer

A searchable, clickable version of the Radtke-Schuller et al. (2016) Mongolian gerbil
brain atlas: 723 structures across 62 coronal plates, each with stereotaxic coordinates,
and each plate in all three of the ways the atlas prints it — labelled drawing, Nissl,
myelin.

## ▶ [Open the Explorer](https://dstolz.github.io/GerbilAtlasExplorer/gerbil_atlas_explorer.html)

Runs in any modern browser — nothing to install, no account, no server. The whole
atlas (all 186 plate images) lives inside the single `gerbil_atlas_explorer.html` file,
so you can also download it and open it offline, on a rig computer with no internet.
It is 20 MB, most of that the plates.

## Quick start

1. **Type a structure** in the search box — abbreviation (`MSO`) or full name
   (`medial superior olive`). Click a result.
2. The plate it sits on opens with the structure **circled**, and its card gives you
   bregma / ML / DV.
3. **Hover anywhere on the plate** to read the coordinates under your pointer. Hover a
   printed abbreviation to see its full name; click it to jump to that structure.
4. Switch the plate to **Nissl** or **Myelin** to see the histology the drawing was made
   from. Everything stays where it was — same coordinates, same circle, same labels
   under your pointer.

## What you can do

**See the actual sections**
- **Labelled / Nissl / Myelin** switches each level between the atlas's own drawing, the
  Nissl-stained section and the Gallyas myelin section printed beside it. All three carry
  the atlas's printed coordinate box and were cropped to it, so they are registered exactly:
  the grid, the measure tool, the circled structure and the hover labels are all still in
  the right place on a section with nothing printed on it.
- **Grey** drops the drawing's colour so the three read alike, and **Contrast** stretches
  whichever one is showing. Both carry into the PNG.

**Find things**
- **Hover anywhere on a structure** — the printed abbreviation included — to read what it
  is, how much of the section it takes up, and how much of its outline the atlas actually
  draws. Either way it is the whole region that highlights, not the word. Click to select it
  and the region is outlined on both hemispheres. The few names the atlas prints *outside*
  the section, `rf` among them, have no region to give and highlight as the label itself.
- Search by abbreviation, name, or alias; filter by system chips (`auditory`,
  `hippocampal`, `thalamus`, …) to see a whole pathway at once.
- **At a coordinate** — go the other way: type bregma / ML / DV and get the structures
  nearest that point. Or hit **Pick on the plate** and just click where you're aiming.
- Step through the 62 plates, zoom and pan, **Fit** to reset.

**Measure and check**
- 1 mm grid and scale bar overlays.
- Click two points to get the **distance and approach angle** between them — useful for
  planning an electrode track.
- **Skull** (experimental) traces a CT skull's cut through the current plate, and outlines
  it around either projection — the same surface the 3D view shows.
- **Landmarks** marks bregma, lambda and the occipital crest where they fall, and draws the
  interaural line. The APs are the atlas's own; the heights come off the skull fit.

**Plan a track** (experimental) — pick a structure and a hemisphere, set the approach
angles, and get the entry point, the angles to dial into the manipulator, and how far to
drive from the brain surface.
- The track draws live on the plate, both projections and the 3D view, dashed on the plate
  where it passes in front of or behind that section. **Right-triangle sides** adds the
  vertical drop and horizontal offset it is the hypotenuse of — what you set on the arm
  before you lower it.
- **The angles are in your frame, not the atlas's.** Set a **Frame** and the plan moves with
  it: at 17° of nose-down pitch, a track that is vertical on the manipulator enters 2.1 mm
  further back than the plate would suggest.
- **Copy notes** or **Download** writes the plan as plain text with the frame it was planned
  in, and **Copy link** restores the whole thing — target, side and angles.
- The surface is the outline of the section, traced off the atlas's own drawings. It is a
  *fixed, sectioned* brain, not the surface under intact dura, and the sections are 350 µm
  apart, so an entry AP is only resolved to the nearest plate.

**See a structure whole** — the printed atlas gives you one coronal plane at a time.
- **Projection** plots every printed label in side view (AP × DV) or top-down (AP × ML),
  with your selected structure highlighted, so you can see how it runs through the brain.
- **3D** stacks the 62 plates where they actually sit: as contours — or as the Nissl or
  myelin sections themselves — as a ray-marched volume, or as a point cloud of all 6,266
  labels you can orbit. Clip to a slab or cut
  it in half at the midline. **Skull** (experimental) wraps the stack in a CT skull
  surface at whatever transparency you set. **Ortho** switches to a parallel projection,
  so nothing is foreshortened. (Needs WebGL 2.)

**Take it with you**
- **PNG** of the current plate with overlays, **SVG** of the same sheet with the regional
  outlines as editable vector paths, **CSV** of the structures you've listed, and
  **Copy link** for a URL back to exactly this plate, structure and view.
- The SVG carries no section image — it is the outlines, traced off the printed plate,
  plus whatever overlays were on: grid, skull, landmarks, the circled structure, the
  measurement, the planned track and the query point, each in its own named group so you
  can restyle or delete one without touching the rest. Opens in Illustrator, Inkscape or
  a browser.

**Where zero is** — **Frame** in the header lets you move the origin: name bregma, lambda,
the interaural line or the occipital crest, and give an AP / ML / DV offset from it if your
zero is not quite on it. Every coordinate is then measured from there, and the readouts say
so — `lambda −5.79` rather than a bare `AP`. Moving zero moves no point, so this is exact:
the projections read their axes from it too, and nothing has to be hedged.

**Your own frame** (experimental) — the same dialog takes a pitch / roll / yaw and a pivot,
since the atlas is cut perpendicular to the brainstem axis and that is not how a head sits in
your stereotaxic frame. You can derive the angles from two points read off the skull. The
*rotation* is new and not fully tested: check adjusted coordinates against anatomy you already
know before relying on them.

## Before you trust a coordinate

- A structure's coordinate is the **median position of where its abbreviation is
  printed** — close to, but not the same as, the structure's centre. It's a targeting
  aid, not a substitute for reading the plate.
- Label positions were read from the plates automatically. Coverage is 94% of
  structure–plate entries; **20 of the 723 structures have no located label**, so they
  have no coordinate. The app tells you when a label is missing rather than showing
  nothing — you may notice a region you expected isn't marked.
- A structure listed for a plate range is present at those levels but is **not
  necessarily printed** on every plate of that range. Of the 3,510 the index lists, 3,298
  carry a located label; the shortfall is mostly structures the plate does not name.
- The **system tags** are a convenience layer added here, not part of the published atlas.
- The **region outlines** are cut from the atlas's own drawn lines, not from a published
  segmentation — the atlas has none. 3,117 structure–plate entries have one, and each says
  how much of its own boundary the atlas prints: the median is 98%, but **6% of regions are
  under half drawn**, and those outlines are dashed and labelled as inferred because that is
  what they are. Where the drawing seals a face and names nothing, nothing is claimed.
- Where the atlas typesets **two names into one label** — `S1Tr/ LPtA`, `Au1 (A1)` — they
  name one region between them, so both give the same outline and the app says which label
  it is. 22 labels on 31 plates are joined this way.
- Nothing here is a segmentation, and the 3D views interpolate between sections that
  are 350 µm apart — the streaking is arithmetic, not anatomy.
- The **myelin** plate of a level is an *adjacent* section, not the same slice as the Nissl:
  the two stains cannot both be applied to one section. It is aligned as published.
- The **skull** overlays are a CT surface of a *different* animal, aligned here rather than
  published with the atlas — good to a few tenths of a millimetre. Context, not a surface to
  measure against.
- The **track planner** is experimental and has not been checked against a track anybody has
  driven. Its brain surface is the outline of the atlas's own drawn section — it reaches
  DV 0 and never crosses it, and 98% of printed labels fall inside it, but it is a fixed,
  sectioned brain and knows nothing about vessels, the sinus or the ventricles.

## Source

All structure-to-plate assignments come verbatim from the authors' published **Index of
structures**, which the paper prints twice — once by name and once by abbreviation. Both
were transcribed and compared (`tools/check_indexes.py`); they agree on all 723 entries.
The one place the database departs from the printed index is four structures whose printed
plate range is malformed, and which are printed on one plate more than it gives them; see
[METHODS](METHODS.md#where-the-index-gives-itself-away). Please cite the atlas itself:

> Radtke-Schuller S, Schuller G, Angenstein F, Grosser OS, Goldschmidt J, Budinger E (2016).
> Brain atlas of the Mongolian gerbil (*Meriones unguiculatus*) in CT/MRI-aided stereotaxic
> coordinates. *Brain Struct Funct* 221(Suppl 1):1–272. doi:10.1007/s00429-016-1259-0

## Files

| File | What it is |
| --- | --- |
| `gerbil_atlas_explorer.html` | The app. Self-contained (~20 MB: 186 plate images, the vectorized outlines and the skull mesh), works offline. Stays at the repository root — it is the published address. |
| `METHODS.md` | How everything here was derived, and what its accuracy is. |
| `TARGETING_PLAN.md` | The design behind the track planner. |
| `data/gerbil_atlas.json` | Full database: structures, coordinates, label positions, brain outlines, region extents, calibration. |
| `data/gerbil_atlas_structures.csv` | One row per structure: abbreviation, name, plate and bregma range, tags. |
| `data/gerbil_atlas_plates.csv` | One row per plate: bregma / lambda / interaural / occipital-crest AP. |
| `data/index_raw.txt` | The authors' published index as extracted. Source of truth for the rest. |
| `svg/` | The traced regional outlines, one SVG per plate, in the published page frame. What the app's SVG export is built from. |
| `qc/` | Verification renders kept from the build — label boxes, coordinate-box detection, plate previews, region overlays. Not used by the app. |
| `tools/` | The region-extent extraction, the one derivation here involved enough that prose alone would not let anyone check it. Run it to rebuild `region_extents` from `svg/` and re-inline it into the app. |

## Website development
This website is developed and maintained by Daniel Stolzberg and the [Caras Lab](https://www.caraslab.org) in the department of Biology at the University of Maryland.

## Under the hood

How the coordinates were calibrated, how the plate images were cropped and the labels
read, how the frame-adjustment math works, and what was verified against what:
**[METHODS.md](METHODS.md)**.

The design the track planner was built from, and the questions that had to be settled
before it could be: **[TARGETING_PLAN.md](TARGETING_PLAN.md)**.
