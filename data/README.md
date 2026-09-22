# Data files

What each file under `data/` is. How it was derived: [METHODS](../METHODS.md).

| File | What it is |
| --- | --- |
| `data/gerbil_atlas.json` | Full database: structures, coordinates, label positions, brain outlines, region extents, the page-to-plate registration, calibration, a version stamp. |
| `data/gerbil_atlas_structures.csv` | One row per structure: abbreviation, name, plate and bregma range, tags. |
| `data/gerbil_atlas_groups.csv` | One row per gross division: its members spelled out, the plates it is on, its other names, and a note saying what it holds and what it deliberately does not. Written by `tools/build_groups.py`; added here, not published with the atlas. |
| `data/gerbil_atlas_parts.csv` | One row per whole the atlas draws under its parts' names: the parts, the plates they stand in for it on, the plates it is drawn on itself, and a note saying what the plates print. Written by `tools/build_parts.py`; a reading of the plates by one stated rule, admitted only where the published index lists the whole. |
| `data/gerbil_atlas_structure_table.csv` | One row per structure with its label center, areas per plate, and the volume and center of its mesh. |
| `data/gerbil_atlas_labels.csv` | One row per printed label — 6,336 stereotaxic triplets, read at the end of the label's leader line where the atlas draws one. |
| `data/gerbil_atlas_plates.csv` | One row per plate: bregma / lambda / interaural / occipital-crest AP. |
| `data/geojson/plate_NN.geojson` | The regional outlines of one plate in millimeters, one feature per structure, with the unnamed faces and the section outline. |
| `data/facemaps/plate_NN.{u16.gz,json}` | The page cut into faces, as `tools/build_region_extents.py` cuts it: the face of every page pixel, and which printed labels seed each. What the region fixer's published page answers **Pick** from, so that answer is the extraction's and not a copy of it. Written by `tools/build_facemaps.py`; CI checks it is a fresh cut. |
| `data/gerbil_atlas_labels.nii.gz`, `data/gerbil_atlas_labels_lut.csv` | The label volume the meshes were cut from, as a NIfTI file at 50 µm: one id per voxel in RAS (x right, y anterior, z dorsal) with the atlas millimeters in its sform, and the table that names each id. Interpolated between sections 350 µm apart, like the meshes. A folded label volume — `DCl` and `VCl` under `Cl`'s id — is a remap of this file by `data/gerbil_atlas_parts.csv`; none is shipped, because the plates do not print one. |
| `data/plates/{drawing,nissl,myelin}/NN.jpg` | The 186 plate images, cropped to the atlas's printed coordinate box. |
| `data/vec.json`, `data/skull.json` | The traced outlines with their per-plate registration, and the CT skull surface: the two assets no script here regenerates. |
| `data/index_raw.txt` | The authors' Index of abbreviations as extracted. Source of truth for the rest. |
| `data/index_structures_raw.txt` | The authors' Index of structures, the second of the two the atlas prints. Read against the first by `tools/check_indexes.py`, which is what says the 723 entries arrived intact. |
| `data/index_published.csv` | The published index as a table: one row per structure, both printed plate fields side by side, the range expanded to a plate list, and a note on every entry whose reading took a decision. Written by `tools/check_indexes.py --write` from the two above and verified against them on every run — the ground truth the database is answerable to. |
| `data/gerbil_atlas_volumes.json` | The brain surface and one mesh per structure, built by stacking the 62 plates and interpolating between them. Fetched by the 3D view on demand; `tools/build_volumes.py --stl` writes the same meshes as STL. See [METHODS](../METHODS.md#the-third-dimension) before trusting the third axis. |
