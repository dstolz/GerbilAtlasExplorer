# Gerbil Atlas Explorer

A searchable, clickable version of the Radtke-Schuller et al. (2016) Mongolian gerbil
brain atlas: 723 structures across 62 coronal plates, each with stereotaxic coordinates.

## ▶ [Open the Explorer](https://dstolz.github.io/GerbilAtlasExplorer/gerbil_atlas_explorer.html)

Runs in any modern browser — nothing to install, no account, no server. The whole
atlas (all 62 plate images) lives inside the single `gerbil_atlas_explorer.html` file,
so you can also download it and open it offline, on a rig computer with no internet.

## Quick start

1. **Type a structure** in the search box — abbreviation (`MSO`) or full name
   (`medial superior olive`). Click a result.
2. The plate it sits on opens with the structure **circled**, and its card gives you
   bregma / ML / DV.
3. **Hover anywhere on the plate** to read the coordinates under your pointer. Hover a
   printed abbreviation to see its full name; click it to jump to that structure.

## What you can do

**Find things**
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

**See a structure whole** — the printed atlas gives you one coronal plane at a time.
- **Projection** plots every printed label in side view (AP × DV) or top-down (AP × ML),
  with your selected structure highlighted, so you can see how it runs through the brain.
- **3D** stacks the 62 plates where they actually sit: as contours, as a ray-marched
  volume, or as a point cloud of all 6,220 labels you can orbit. Clip to a slab or cut
  it in half at the midline. **Skull** (experimental) wraps the stack in a CT skull
  surface at whatever transparency you set. (Needs WebGL 2.)

**Take it with you**
- **PNG** of the current plate with overlays, **CSV** of the structures you've listed,
  and **Copy link** for a URL back to exactly this plate, structure and view.

**Your own frame** (experimental) — the atlas is cut perpendicular to the brainstem
axis, which is not how a head sits in your stereotaxic frame. **Frame** in the header
lets you enter a pitch / roll / yaw and a pivot (bregma, lambda, interaural, occipital
crest), and restates coordinates in your frame — or derive the angles from two points
you read off the skull. You can also name where **zero** is, so coordinates read from
lambda instead of bregma. This is new and not fully tested: check adjusted coordinates
against anatomy you already know before relying on them.

## Before you trust a coordinate

- A structure's coordinate is the **median position of where its abbreviation is
  printed** — close to, but not the same as, the structure's centre. It's a targeting
  aid, not a substitute for reading the plate.
- Label positions were read from the plates automatically. Coverage is 93% of
  structure–plate entries; **20 of the 723 structures have no located label**, so they
  have no coordinate. The app tells you when a label is missing rather than showing
  nothing — you may notice a region you expected isn't marked.
- A structure listed for a plate range is present at those levels but is **not
  necessarily printed** on every plate of that range.
- The **system tags** are a convenience layer added here, not part of the published atlas.
- Nothing here is a segmentation, and the 3D views interpolate between sections that
  are 350 µm apart — the streaking is arithmetic, not anatomy.
- The **skull** overlays are a CT surface of a *different* animal, aligned here rather than
  published with the atlas — good to a few tenths of a millimetre. Context, not a surface to
  measure against.

## Source

All structure-to-plate assignments come verbatim from the authors' published **Index of
structures**. Please cite the atlas itself:

> Radtke-Schuller S, Schuller G, Angenstein F, Grosser OS, Goldschmidt J, Budinger E (2016).
> Brain atlas of the Mongolian gerbil (*Meriones unguiculatus*) in CT/MRI-aided stereotaxic
> coordinates. *Brain Struct Funct* 221(Suppl 1):1–272. doi:10.1007/s00429-016-1259-0

## Files

| File | What it is |
| --- | --- |
| `gerbil_atlas_explorer.html` | The app. Self-contained (~6.9 MB, including the skull mesh), works offline. |
| `gerbil_atlas.json` | Full database: structures, coordinates, label positions, calibration. |
| `gerbil_atlas_structures.csv` | One row per structure: abbreviation, name, plate and bregma range, tags. |
| `gerbil_atlas_plates.csv` | One row per plate: bregma / lambda / interaural / occipital-crest AP. |
| `index_raw.txt` | The authors' published index as extracted. Source of truth for the rest. |

## Website development
This website is developed and maintained by Daniel Stolzberg and the [Caras Lab](https://www.caraslab.org) in the department of Biology at the University of Maryland.

## Under the hood

How the coordinates were calibrated, how the plate images were cropped and the labels
read, how the frame-adjustment math works, and what was verified against what:
**[METHODS.md](METHODS.md)**.
