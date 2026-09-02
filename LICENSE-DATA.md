# Licence for the data and images

## The derived data

Everything this repository derived from the atlas — `data/gerbil_atlas.json`,
`data/gerbil_atlas_volumes.json`, the CSV, GeoJSON and table exports under
`data/`, the tracings in `svg/`, the QC renders in `qc/`, and the same data where
it is inlined into the app — is released under the
**Creative Commons Attribution 4.0 International licence (CC BY 4.0)**,
https://creativecommons.org/licenses/by/4.0/.

You may copy, redistribute and adapt it for any purpose, including commercially,
provided you give appropriate credit. Please credit both the atlas and this
repository:

> Radtke-Schuller S, Schuller G, Angenstein F, Grosser OS, Goldschmidt J, Budinger E
> (2016). Brain atlas of the Mongolian gerbil (*Meriones unguiculatus*) in CT/MRI-aided
> stereotaxic coordinates. *Brain Struct Funct* 221(Suppl 1):1–272.
> doi:10.1007/s00429-016-1259-0

> Stolzberg D, Caras Lab, University of Maryland. Gerbil Atlas Explorer.
> https://github.com/dstolz/GerbilAtlasExplorer (see CITATION.cff)

Nothing here is a segmentation, and every coordinate is a targeting aid carrying
the atlas's own error; see METHODS.md before relying on a number.

## The plate images

The 186 plate images (`data/plates/`, and inlined into the app) are cropped
reproductions of the section pages of the atlas supplement, which the authors
published open access. They remain the work of Radtke-Schuller et al. and are
reproduced here under the terms of that publication's licence, with attribution
to the source as above. They are not relicensed by this repository: reuse of the
images is governed by the source publication's licence, not by the CC BY 4.0
grant above, and any reuse must credit the atlas.

## The skull

`data/skull.json` is a decimated surface of a µCT scan of a gerbil skull, a
different animal from the atlas's, registered to the atlas here (METHODS.md, "The
skull"). It is released under CC BY 4.0 with the derived data above.
