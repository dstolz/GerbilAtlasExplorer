# Before you trust a coordinate

What each number in the Explorer is, and where it stops being reliable. How each was
derived is in [METHODS.md](METHODS.md).

- A structure's coordinate is the **median position of where its abbreviation is
  printed** — close to, but not the same as, the structure's center. It's a targeting
  aid, not a substitute for reading the plate. Where the atlas could not fit the name inside
  the region and set it outside with a line drawn back in, the coordinate is the end of that
  line rather than the word: 212 labels on 47 plates, a median 0.52 mm apart.
- Label positions were read from the plates automatically. Coverage is 95% of
  structure–plate entries; **7 of the 723 structures have no located label**, so they
  have no coordinate. The app tells you when a label is missing rather than showing
  nothing — you may notice a region you expected isn't marked.
- A structure listed for a plate range is present at those levels but is **not
  necessarily printed** on every plate of that range. Of the 3,510 the index lists, 3,338
  carry a located label; the shortfall is mostly structures the plate does not name.
- The **system tags** are a convenience layer added here, not part of the published atlas.
- The **gross divisions** are the same kind of addition, and a larger one: the atlas publishes
  no hierarchy, so which structures make up "the pons" is a judgement made here. It is written
  out in full — `data/gerbil_atlas_groups.csv` names every member of every division, and
  `tools/build_groups.py` is the rules that produced them — so it can be read and argued with.
  The one boundary the atlas's own geometry settles is the pons against the medulla, drawn at
  the last plate that prints the facial nucleus (plate 49, bregma −9.00 mm); a structure
  spanning it is in both. Where the geometry settles nothing the source is named instead: the
  hippocampal formation stops at the subiculum and the entorhinal, perirhinal and subicular
  cortices beyond it are the parahippocampal region, which is the line
  [Chauhan et al. (2021)](https://www.ncbi.nlm.nih.gov/books/NBK575732/) draw. Six structures
  are in no division: two arteries, a blood vessel and three surface fissures, which are
  landmarks on the section rather than parts of the brain.
- The **region outlines** are cut from the atlas's own drawn lines, not from a published
  segmentation — the atlas has none. 3,065 structure–plate entries have one, and each says
  how much of its own boundary the atlas prints: the median is 98%, but **3% of regions are
  under half drawn**, and those outlines are dashed and labeled as inferred because that is
  what they are. Where the drawing seals a face and names nothing, nothing is claimed.
- **A name that is no region has none of that**, and the twenty of them are named in
  `features` in the JSON. The 184 mm² they used to be given goes to whichever region is
  nearest around the atlas's own lines, which is how a lobule comes out whole. That split is
  an estimate wherever the fissure line runs out, and one place it over-reaches: `IntDL` on
  plate 47, drawn by the atlas as an open crescent, takes 3.7 mm² of the medullary body it
  borders where the hump itself is 0.6. It carries no outline, but its mesh is wide at that
  plane. See [METHODS](METHODS.md#region-extents).
- Where the atlas typesets **two names into one label** — `S1Tr/ LPtA`, `Au1 (A1)` — they
  name one region between them, so both give the same outline and the app says which label
  it is. 27 labels on 41 plates are joined this way.
- Nothing here is a segmentation, and the 3D views interpolate between sections that
  are 350 µm apart — the streaking is arithmetic, not anatomy.
- The **myelin** plate of a level is an *adjacent* section, not the same slice as the Nissl:
  the two stains cannot both be applied to one section. It is aligned as published.
- The **skull** overlays are a CT surface of a *different* animal, aligned here rather than
  published with the atlas — good to a few tenths of a millimeter. Context, not a surface to
  measure against.
- The **track planner** is experimental and has not been checked against a track anybody has
  driven. Its brain surface is the outline of the atlas's own drawn section — it reaches
  DV 0 and never crosses it, and 98% of printed labels fall inside it, but it is a fixed,
  sectioned brain and knows nothing about vessels, the sinus or the ventricles.
- **Along the track** and the **footprint** read the regional outlines of the nearest
  plate at each sample: a boundary that runs obliquely between two plates lands on
  whichever plate is nearer, and where the atlas prints no boundary the outline is an
  estimate and the row says so.
