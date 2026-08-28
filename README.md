# Gerbil Atlas Explorer

Queryable index of the Radtke-Schuller et al. (2016) Mongolian gerbil brain atlas:
723 structures across 62 coronal plates, with stereotaxic coordinates and the
on-plate position of every printed abbreviation.

[Use the Gerbil Atlas Explorer](https://dstolz.github.io/GerbilAtlasExplorer/gerbil_atlas_explorer.html)

## Files

| File | What it is |
| --- | --- |
| `gerbil_atlas_explorer.html` | Self-contained browser app. Open it directly — no server, no internet. Search, filter by system, step through plates, see a selected structure circled on the plate, and hover any printed label to read the structure's full name. All 62 plate images are embedded (~6.3 MB). |
| `gerbil_atlas.json` | Full database: structures, plate coordinates, system tags, aliases, label positions, verification record. |
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

## Plate images

Plates are cropped **relative to the printed coordinate frame**, detected per page,
rather than to fixed page fractions. This matters: in the source PDF the plate 31
figure sits 118 px (at 300 dpi) lower on the page than every other plate, and plates 1
and 10 are offset by 2–3 px. Frame-relative cropping puts all 62 images in one
common coordinate frame.

## Label positions

`label_positions` in the JSON records where each abbreviation is printed on each
plate, as `[cx, cy, w, h]` fractions of the frame-cropped image. Most structures
appear twice, once per hemisphere. 4,164 individual labels were located, covering
2,532 of the 3,506 structure-plate entries. These drive the circling and the hover tooltips in the HTML app
and can be reused for annotation overlays elsewhere.

## Caveats

- **System tags** (`auditory`, `hippocampal`, `thalamus`, …) are a convenience layer
  added on top of the published nomenclature. They are not part of the original atlas.
  The `auditory` tag covers the full ascending pathway: cochlear nuclei → superior
  olivary complex → lemniscal nuclei → inferior colliculus → medial geniculate → cortex.
- A structure listed for a plate range is present at those levels, but is **not
  necessarily labelled** on every plate of that range.
- Label positions come from OCR. Where a label was not located, the app says so
  rather than showing nothing.
- One discrepancy in the source: **AngT** is printed on plate 29, but the published
  index lists only plate 28. The database follows the published index.
