# Gerbil Atlas Explorer

A searchable, clickable version of the Radtke-Schuller et al. (2016) Mongolian gerbil
brain atlas: 723 structures across 62 coronal plates, each with stereotaxic coordinates,
and each plate in all three of the ways the atlas prints it — labeled drawing, Nissl,
myelin.

## ▶ [Open the Explorer](https://dstolz.github.io/GerbilAtlasExplorer/)

Runs in any modern browser — nothing to install, no account, no server — and keeps working
offline once it has been opened. For a computer that never sees the internet, download the
single-file build,
[`gerbil_atlas_explorer.html`](https://dstolz.github.io/GerbilAtlasExplorer/gerbil_atlas_explorer.html)
(22 MB, every plate inside it).

**User guide: [the wiki][wiki].**

## Quick start

1. **Type a structure** in the search box — `MSO` or `medial superior olive` — and click a
   result.
2. Its plate opens with the structure **circled**, and its card gives bregma / ML / DV.
3. **Hover the plate** to read the coordinates under your pointer. Hover a printed
   abbreviation for its full name; click it to select that structure.
4. Switch the plate between **Labeled**, **Nissl** and **Myelin**. The coordinates, the
   circle and the labels stay where they were.

## Features

- **[Finding structures][find]** — search by abbreviation, name or alias; filter by system
  or by gross division.
- **[Reading a plate][plate]** — the atlas's drawing, Nissl, myelin or MRI; regions colored
  as a map, a second plate side by side, your own notes.
- **[At a coordinate][at]** — give a point, get the structures nearest it.
- **[Measuring][measure]** — grid, scale bar, distance and approach angle, landmarks, and a
  skull outline *(experimental)*.
- **[Projection and 3D][3d]** — a structure through the whole brain: side and top
  projections, the stacked sections, per-structure meshes.
- **[Planning a track][track]** *(experimental)* — entry point, manipulator angles, drive
  depth, and what the track passes through.
- **[Working frame][frame]** — read coordinates from bregma, lambda, the interaural line or
  the occipital crest, or from your own tilted frame *(rotation experimental)*.
- **[Exporting][export]** — PNG, SVG with editable outlines, CSV, and a link that restores
  the exact view.

Also in the wiki: [Keyboard Shortcuts][keys], [Recipes][recipes],
[Troubleshooting][trouble], [FAQ][faq].

## Before you trust a coordinate

A structure's coordinate is the **median position of where its abbreviation is printed** —
close to, but not the same as, the structure's center. It is a targeting aid, not a
substitute for reading the plate. The region outlines are cut from the atlas's own drawn
lines, not from a published segmentation, and the 3D views interpolate between sections
350 µm apart. [CAVEATS.md](CAVEATS.md) has the full list, with numbers;
[METHODS.md](METHODS.md) says how everything was derived.

## Data

Everything the app shows is also in [`data/`](data/) as plain files: the full database
(JSON), tables (CSV), per-plate outlines (GeoJSON), structure meshes and a NIfTI label
volume. [`data/README.md`](data/README.md) describes each file.

## Source and citation

All structure-to-plate assignments come from the authors' published **Index of
structures**, except four structures whose printed plate range is malformed; see
[METHODS](METHODS.md#where-the-index-gives-itself-away). Please cite the atlas itself:

> Radtke-Schuller S, Schuller G, Angenstein F, Grosser OS, Goldschmidt J, Budinger E (2016).
> Brain atlas of the Mongolian gerbil (*Meriones unguiculatus*) in CT/MRI-aided stereotaxic
> coordinates. *Brain Struct Funct* 221(Suppl 1):1–272. doi:10.1007/s00429-016-1259-0

[CITATION.cff](CITATION.cff) covers citing both the atlas and this tool.

## License

The code is MIT; the derived data — the database, the tables, the outlines, the meshes —
is CC BY 4.0, with the plate images reproduced from the open-access atlas under its own
license. See [LICENSE](LICENSE) and [LICENSE-DATA.md](LICENSE-DATA.md).

## About

Developed and maintained by Daniel Stolzberg and the [Caras Lab](https://www.caraslab.org)
in the Department of Biology at the University of Maryland.

The site counts visits with [GoatCounter](https://www.goatcounter.com): cookieless, nothing
that names a reader is kept, and the plate, structure and view in the URL are not sent. Only
the page served from `dstolz.github.io` counts; a downloaded copy or a fork's site counts
nothing. To turn counting off, empty `CODE` in `src/app.html` and run
`python3 tools/build_app.py --lean`.

[wiki]: https://github.com/dstolz/GerbilAtlasExplorer/wiki
[find]: https://github.com/dstolz/GerbilAtlasExplorer/wiki/Finding-Structures
[plate]: https://github.com/dstolz/GerbilAtlasExplorer/wiki/Reading-a-Plate
[at]: https://github.com/dstolz/GerbilAtlasExplorer/wiki/At-a-Coordinate
[measure]: https://github.com/dstolz/GerbilAtlasExplorer/wiki/Measuring
[3d]: https://github.com/dstolz/GerbilAtlasExplorer/wiki/Projection-and-3D
[track]: https://github.com/dstolz/GerbilAtlasExplorer/wiki/Planning-a-Track
[frame]: https://github.com/dstolz/GerbilAtlasExplorer/wiki/Working-Frame
[export]: https://github.com/dstolz/GerbilAtlasExplorer/wiki/Exporting
[keys]: https://github.com/dstolz/GerbilAtlasExplorer/wiki/Keyboard-Shortcuts
[recipes]: https://github.com/dstolz/GerbilAtlasExplorer/wiki/Recipes
[trouble]: https://github.com/dstolz/GerbilAtlasExplorer/wiki/Troubleshooting
[faq]: https://github.com/dstolz/GerbilAtlasExplorer/wiki/FAQ
