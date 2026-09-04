# Gerbil Atlas Explorer

A searchable, clickable version of the Radtke-Schuller et al. (2016) Mongolian gerbil
brain atlas: 723 structures across 62 coronal plates, each with stereotaxic coordinates,
and each plate in all three of the ways the atlas prints it — labelled drawing, Nissl,
myelin.

## ▶ [Open the Explorer](https://dstolz.github.io/GerbilAtlasExplorer/)

Runs in any modern browser — nothing to install, no account, no server. That page loads
the plates as it needs them and keeps working offline once it has been opened. For a
rig computer that never sees the internet, download the single-file build,
[`gerbil_atlas_explorer.html`](https://dstolz.github.io/GerbilAtlasExplorer/gerbil_atlas_explorer.html):
the whole atlas (all 186 plate images) lives inside it, 22 MB, most of that the plates.

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
- **MRI** is a fourth source: the atlas's own reference MRI, the imaging half of the
  "CT/MRI-aided" in its title. It is already in the atlas's coordinates, one slice per
  plate, so the outlines and the readout land on it unchanged. Two things it is not — the
  whole head rather than a cut section, so there is skull, scalp and eye in the picture;
  and 117 µm voxels against the drawing's 18, so it is soft where the drawing is sharp.
- **Grey** drops the drawing's colour so the three read alike, and **Contrast** stretches
  whichever one is showing. Both carry into the PNG.
- **Colour regions** paints the section as a map: every region filled, and no two regions
  that touch given the same colour. It shows the whole partition at once — where one
  structure stops and the next starts, how much of the section each holds, which of them are
  neighbours — and on the Nissl, the myelin and the MRI, which print no lines at all, it is
  the only view that shows any of it. **Wash** sets how strongly the colours are laid on, and
  both ride into the PNG and the SVG. A colour means nothing beyond "not my neighbour": it is
  not a system or a division, and two regions of one colour have nothing in common except
  that they do not touch. Each region does ask for the same colour on every plate it is drawn
  on, and gets it about half the time, so stepping through the levels is not a kaleidoscope.
  Nothing is painted that the atlas does not draw — the names it draws no boundary between
  share a colour rather than being split by one, and the faces it seals and names nothing
  inside are left unpainted.

**Find things**
- **Hover anywhere on a structure** — the printed abbreviation included — to read what it
  is, how much of the section it takes up, and how much of its outline the atlas actually
  draws. Either way it is the whole region that highlights, not the word. Click to select it
  and the region is outlined on both hemispheres, even where the atlas letters only one of
  them. The names that are no region — the fissures and sulci, `cbw`, the vessels — have
  none to give, and neither do the few structures no extent could be cut for; those
  highlight as the printed name itself.
- **A fissure is not a region, and neither is `cbw`.** Twenty of the 723 names the atlas
  prints name no ground of their own: the sixteen fissures, sulci and the rhinal incisure,
  which are the clefts *between* regions and are drawn as the lines between them; `cbw`,
  the white matter core of whichever lobule it runs through rather than a lobule beside
  them; and the three vessels. They are searched, listed, filtered, located on every plate
  that prints them, and plotted in the projection and the label cloud like anything else —
  hover or select one and every place the plate prints its name is marked, and the tip says
  what it is. What they have no claim on is ground, so they have no outline, no area and no
  mesh, and what they were being given belongs to the regions around them. On plate 54
  `Crus2` is now the whole ansiform lobule between `icf` and `apmf`, white matter and all,
  where `cbw` had been holding 11.8 mm² of that cerebellum and had left `Crus2` a wedge of
  its own lobule and `PM` nothing but its label box.
- **Where the atlas draws no boundary, none is drawn here.** Its drawing sometimes puts
  several names inside one boundary and prints nothing between them — the cerebellar
  lobules against each other, the mediodorsal thalamus, the lateral hypothalamic zones.
  Those structures are still found, listed, measured and
  modelled, but they get no outline: hover or select one and every place the plate prints
  its name highlights instead, and the tip says why. An outline there would be a boundary
  this atlas does not have.
- Search by abbreviation, name, or alias — `NAc`, `MGB`, `nucleus accumbens`, `SOC` and
  seventy other names from other nomenclatures resolve, and the result says which alias
  brought it in; a query that matches nothing exactly offers its close matches. Filter by
  system chips (`auditory`, `hippocampal`, `thalamus`, …) to see a whole pathway at once.
- **Whole divisions** — the atlas names 723 structures and no containers for them: there is
  no "hippocampus" in the index, only CA1, CA2, CA3, DG and their layers. Twenty gross
  divisions are added here — cortex and its four lobes, the hippocampal formation, the
  olfactory areas and the bulb, amygdala, striatum and pallidum, septum and basal forebrain,
  thalamus, hypothalamus, midbrain, pons, medulla, brainstem, cerebellum, fibre tracts,
  ventricles — and each behaves like a structure: pick one and it is outlined on the plate
  in its own colour, listed on every plate it is on, plotted in the projection, and drawn in
  3D as its members' meshes. A division has no geometry of its own. Its outline is its
  members' outlines with the walls between them dropped, its area the sum of theirs, its
  coordinate the median of their printed labels — so nothing it shows is a boundary the atlas
  does not draw. **List them** narrows the structure list to one division's members, which is
  what the CSV and the label table then write. Divisions overlap on purpose: the brainstem is
  the midbrain, pons and medulla together, the bulb sits inside the olfactory areas, and a
  structure's own card says which divisions it is in.
- **At a coordinate** — go the other way: type bregma / ML / DV and get the structures
  nearest that point. Or hit **Pick on the plate** and just click where you're aiming.
- Step through the 62 plates, zoom and pan, **Fit** to reset.
- **Maximise** (the corners button, or <kbd>F</kbd>) gives the whole window to whichever
  view is open — plate, projection or 3D. The search column, the header and the footer
  step out, and the browser is asked for its own chrome as well, so a rig screen or a
  projector shows nothing but the section and the controls that drive it. <kbd>Esc</kbd>
  comes back.

**Measure and check**
- 1 mm grid and scale bar overlays.
- Click two points to get the **distance and approach angle** between them — useful for
  planning an electrode track.
- **Skull** (experimental) traces a CT skull's cut through the current plate, and outlines
  it around either projection — the same surface the 3D view shows.
- **Landmarks** marks bregma, lambda and the occipital crest where they fall, and draws the
  interaural line — on the plate, around either projection, and in the 3D view. The APs are
  the atlas's own; the heights come off the skull fit.

**Plan a track** (experimental) — pick a structure and a hemisphere, set the approach
angles, and get the entry point, the angles to dial into the manipulator, and how far to
drive from the brain surface.
- **Along the track** lists what the track passes through, with the depth each structure
  spans from the surface, read off the regional outlines of the nearest plate every 20 µm
  and drawn as a bar beside the plan and as ticks on the plate. Give it a **probe length**
  — 3.84 mm for a Neuropixels 1.0 shank — and it reads the whole shank and says what the
  tip ends in.
- **Footprint** places a sphere of a given radius about the target and lists the share of
  its volume in each structure — where an injection of that volume would sit, if it
  spread evenly. It places a volume; it does not model spread.
- The track draws live on the plate, both projections and the 3D view, dashed on the plate
  where it passes in front of or behind that section. **Right-triangle sides** adds the
  vertical drop and horizontal offset it is the hypotenuse of — what you set on the arm
  before you lower it.
- **The angles are in your frame, not the atlas's.** Set a **Frame** and the plan moves with
  it: at 17° of nose-down pitch, a track that is vertical on the manipulator enters 2.1 mm
  further back than the plate would suggest.
- **Take the label from** picks the plate to read the target off. A structure printed on a
  dozen sections has a label on each, and the median of all of them sits in the middle of
  the structure rather than on the section you are aiming at; naming one plate reads that
  section's labels alone, and turns the viewer to it.
- **Offset** aims somewhere other than the label itself — 0.2 mm dorsal to `VO` on plate 13,
  say. The plan then prints the label and the target as separate rows, so the point the
  numbers were measured from stays readable beside the point they are about. The offset is
  in *atlas* millimetres, not the frame's, because naming a target is anatomy; lateral is
  taken toward whichever hemisphere is chosen, so the two sides stay mirror images.
- **Copy notes** or **Download** writes the plan as plain text with the frame it was planned
  in, **JSON** writes every number of it typed, and **Copy link** restores the whole thing —
  target, side, angles, plate, offset, probe and footprint.
- The surface is the outline of the section, traced off the atlas's own drawings. It is a
  *fixed, sectioned* brain, not the surface under intact dura, and the sections are 350 µm
  apart, so an entry AP is only resolved to the nearest plate.

**Compare** puts a second plate beside the first under the same zoom, pan and crosshair —
the other histology of this level, the drawing, or the plate before or after — so what is
under the pointer on one is under it on the other.

**Notes** are your own markers: click the plate where an electrode tip, a lesion or a
place to come back to is, give it a line of text, and a marker draws there and on the
projections and the 3D view alike. Click a marker to read the note, rewrite it or delete
it; the **Notes** pane lists every one with its coordinates in whatever frame is set. They
stay in your browser; export them as JSON to keep or share them, and a link carries a
handful.

**See a structure whole** — the printed atlas gives you one coronal plane at a time.
- Selecting a structure shows it on **every plate it is on**, as a strip of thumbnails
  cropped around it; click one to go there.
- **Projection** plots every printed label in side view (AP × DV) or top-down (AP × ML),
  with your selected structure highlighted, so you can see how it runs through the brain.
- **3D** stacks the 62 plates where they actually sit and opens with **Volume**, the stack
  ray-marched, so the first sight of it is the brain as a solid. **Contours** draws the
  sections themselves — the atlas's own boundaries, or the Nissl or myelin section — one
  textured plate at a time, and **Labels** is a point cloud of all 6,315 printed
  abbreviations you can orbit. Clip to a slab or cut
  it in half at the midline. **Floor**, **Ceiling** and **Gamma** window the tissue before
  **Density** decides how opaque it is drawn — the difference between a grey fog and a
  render you can see a nucleus in, and on the labelled drawing a high floor takes the wash
  away and leaves the contours alone. All four ride in the link. **Skull** (experimental) wraps the stack in a CT skull
  surface at any transparency from a faint shell to solid bone. **Landmarks** stands bregma,
  lambda, the interaural axis and the occipital crest in the stack: each landmark's coronal
  plane as a rule up the midline, a cross on the vault, and the interaural line as the
  ear-bar axis running out past the brain to a ring at each canal — the one view where it is
  a line and not a point. **Ortho** switches to a
  parallel projection, so nothing is foreshortened. **View** puts the camera on an
  anatomical axis — left, right, rostral, caudal, dorsal or ventral — and the link you
  copy carries it. **Meshes** fetches the closed surfaces built offline from the outlines
  (20 MB, once) and shows the selected structure — or a short filtered list — as a mesh.
  Six planes in seven of a mesh are interpolated between
  sections 350 µm apart; see [METHODS](METHODS.md#the-third-dimension). (Needs WebGL 2.)
- **Split** puts a second 3D view beside the first, sharing the one stack, label cloud and
  set of meshes — so it costs pixels and nothing else. Everything above belongs to a pane
  rather than to the view: **A** and **B** choose which pane the toolbar sets, and each can
  have its own mode, contrast, slab, midline cut, projection, skull, landmarks and meshes.
  The sections beside the volume they came from, a whole brain beside a slab, a structure's
  mesh beside the section it was built from. Clicking into a pane makes it the one the toolbar is on.
  **Lock** turns, zooms and pans both panes together, holding whatever angle apart they
  were set to — so one pair can be a lateral and a dorsal view of the same brain, moving as
  one. Untick it to rotate them separately; **Reset view** brings a locked pair back onto
  the one default, which is also how a pair that has drifted apart is brought together. The
  link carries both panes.

**Take it with you**
- **PNG** of the current plate with overlays, **SVG** of the same sheet with the regional
  outlines as editable vector paths and one named group per region, **CSV** of the
  structures you've listed, **Labels** for one row per printed label of them with its
  stereotaxic triplet, and **Copy link** for a URL back to exactly this plate, structure
  and view.
- The same tables, for every structure and every label, are committed under
  [`data/`](data/) with GeoJSON of the outlines per plate — see the file list below.
- The SVG carries no section image — it is the outlines, traced off the printed plate,
  plus whatever overlays were on: grid, skull, landmarks, the circled structure, the
  measurement, the planned track, the query point and your notes, each in its own named group so you
  can restyle or delete one without touching the rest. Opens in Illustrator, Inkscape or
  a browser.

**Where zero is** — **Frame** in the header lets you move the origin: name bregma, lambda,
the interaural line or the occipital crest, and give an AP / ML / DV offset from it if your
zero is not quite on it. Every coordinate is then measured from there, and the readouts say
so — `lambda −5.79` rather than a bare `AP`. Moving zero moves no point, so this is exact:
the projections read their axes from it too, and nothing has to be hedged.

**Height** fills DV in for you, which is what the **interaural line** needs: it is the
ear-bar axis rather than a point on the brain, running about 9 mm ventral to the dorsal
plane the atlas measures DV from, so zeroing on it with DV left at 0 is out by all of that.
Set the height and the readout is ordinary interaural coordinates — AP behind the ear bars,
DV up from them, with `MSO` at `interaural −0.70 · DV +0.75`. The same row under the pivot
puts a rotation on the ear-bar axis instead of a parallel one several millimetres too high.
The APs are the atlas's own and exact; the heights come off the skull fit and are approximate.

**Your own frame** (experimental) — the same dialog takes a pitch / roll / yaw and a pivot,
since the atlas is cut perpendicular to the brainstem axis and that is not how a head sits in
your stereotaxic frame. You can derive the angles from two points read off the skull. The
*rotation* is new and not fully tested: check adjusted coordinates against anatomy you already
know before relying on them.

**In frame** — once an angle is set, a checkbox by that name appears in the toolbar of the
projection and the 3-D view. Tick it and the label cloud and the section stack are turned into
your frame, so up on the screen is your frame's DV and the axes are the ones your manipulator
drives; the two views share the one setting. Untick it and both are back in the atlas's
orientation, which is the one every published figure is in. A turned view is the same rigid
rotation as the numbers above it — the same 62 coronal sections stood up at an angle, not
recut — and the skull outline and landmark rules, which are flattened at the atlas's angle and
cannot be re-flattened at yours, are unavailable while it is on.

## Before you trust a coordinate

- A structure's coordinate is the **median position of where its abbreviation is
  printed** — close to, but not the same as, the structure's centre. It's a targeting
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
  spanning it is in both. Six structures are in no division: two arteries, a blood vessel and
  three surface fissures, which are landmarks on the section rather than parts of the brain.
- The **region outlines** are cut from the atlas's own drawn lines, not from a published
  segmentation — the atlas has none. 3,065 structure–plate entries have one, and each says
  how much of its own boundary the atlas prints: the median is 98%, but **3% of regions are
  under half drawn**, and those outlines are dashed and labelled as inferred because that is
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
  published with the atlas — good to a few tenths of a millimetre. Context, not a surface to
  measure against.
- The **track planner** is experimental and has not been checked against a track anybody has
  driven. Its brain surface is the outline of the atlas's own drawn section — it reaches
  DV 0 and never crosses it, and 98% of printed labels fall inside it, but it is a fixed,
  sectioned brain and knows nothing about vessels, the sinus or the ventricles.
- **Along the track** and the **footprint** read the regional outlines of the nearest
  plate at each sample: a boundary that runs obliquely between two plates lands on
  whichever plate is nearer, and where the atlas prints no boundary the outline is an
  estimate and the row says so.

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
| `index.html` | The app, built: 5 MB, loads the plates as it needs them, works offline after a visit. What the link above opens. |
| `gerbil_atlas_explorer.html` | The same app as one self-contained file (22 MB: 186 plate images, the vectorized outlines and the skull mesh) for a computer with no internet. Both pages are built by `tools/build_app.py` from `src/` and `data/`; a commit and date are stamped into each. |
| `src/` | The app's source: `app.html`, `app.css`, `app.js`. `python3 tools/build_app.py --dev` writes `build/dev.html`, which links these directly, so code edits need no rebuild. |
| `METHODS.md` | How everything here was derived, and what its accuracy is. |
| `TARGETING_PLAN.md` | The design behind the track planner. |
| `data/gerbil_atlas.json` | Full database: structures, coordinates, label positions, brain outlines, region extents, the page-to-plate registration, calibration, a version stamp. |
| `data/gerbil_atlas_structures.csv` | One row per structure: abbreviation, name, plate and bregma range, tags. |
| `data/gerbil_atlas_groups.csv` | One row per gross division: its members spelled out, the plates it is on, its other names, and a note saying what it holds and what it deliberately does not. Written by `tools/build_groups.py`; added here, not published with the atlas. |
| `data/gerbil_atlas_structure_table.csv` | One row per structure with its label centre, areas per plate, and the volume and centre of its mesh. |
| `data/gerbil_atlas_labels.csv` | One row per printed label — 6,315 stereotaxic triplets, read at the end of the label's leader line where the atlas draws one. |
| `data/gerbil_atlas_plates.csv` | One row per plate: bregma / lambda / interaural / occipital-crest AP. |
| `data/geojson/plate_NN.geojson` | The regional outlines of one plate in millimetres, one feature per structure, with the unnamed faces and the section outline. |
| `data/gerbil_atlas_labels.nii.gz`, `data/gerbil_atlas_labels_lut.csv` | The label volume the meshes were cut from, as a NIfTI file at 50 µm: one id per voxel in RAS (x right, y anterior, z dorsal) with the atlas millimetres in its sform, and the table that names each id. Interpolated between sections 350 µm apart, like the meshes. |
| `data/plates/{drawing,nissl,myelin}/NN.jpg` | The 186 plate images, cropped to the atlas's printed coordinate box. |
| `data/vec.json`, `data/skull.json` | The traced outlines with their per-plate registration, and the CT skull surface: the two assets no script here regenerates. |
| `data/index_raw.txt` | The authors' Index of abbreviations as extracted. Source of truth for the rest. |
| `data/index_structures_raw.txt` | The authors' Index of structures, the second of the two the atlas prints. Read against the first by `tools/check_indexes.py`, which is what says the 723 entries arrived intact. |
| `data/index_published.csv` | The published index as a table: one row per structure, both printed plate fields side by side, the range expanded to a plate list, and a note on every entry whose reading took a decision. Written by `tools/check_indexes.py --write` from the two above and verified against them on every run — the ground truth the database is answerable to. |
| `data/gerbil_atlas_volumes.json` | The brain surface and one mesh per structure, built by stacking the 62 plates and interpolating between them. Fetched by the 3D view on demand; `tools/build_volumes.py --stl` writes the same meshes as STL. See [METHODS](METHODS.md#the-third-dimension) before trusting the third axis. |
| `svg/` | The traced regional outlines, one SVG per plate, in the published page frame. |
| `qc/` | Verification renders kept from the build; [`qc/README.md`](qc/README.md) says which script writes each. Not used by the app. |
| `tools/` | The derivations that read something off the page rather than fitting a number to it, the shared library they use, the build, and the table exports. See [`tools/README.md`](tools/README.md). |
| `tests/` | The data's own promises as `pytest` tests, and the built pages in a browser under Playwright. GitHub Actions runs both on every push. |
| `sw.js`, `manifest.webmanifest` | What makes the lean page work offline and installable. |

## Building and testing

```
python3 tools/build_app.py --lean       # rebuild both pages from src/ and data/
python3 tools/build_app.py --check      # are the committed pages a fresh build
python3 -m pytest tests/python          # the data's invariants
npm ci && npx playwright install chromium && npm run build && npm test   # the pages in a browser
```

## Licence

The code is MIT; the derived data — the database, the tables, the outlines, the meshes —
is CC BY 4.0, with the plate images reproduced from the open-access atlas under its own
licence. See [LICENSE](LICENSE), [LICENSE-DATA.md](LICENSE-DATA.md) and
[CITATION.cff](CITATION.cff) for how to cite both the atlas and this tool.

## Website development
This website is developed and maintained by Daniel Stolzberg and the [Caras Lab](https://www.caraslab.org) in the department of Biology at the University of Maryland.

## Under the hood

How the coordinates were calibrated, how the plate images were cropped and the labels
read, how the frame-adjustment math works, and what was verified against what:
**[METHODS.md](METHODS.md)**.

The design the track planner was built from, and the questions that had to be settled
before it could be: **[TARGETING_PLAN.md](TARGETING_PLAN.md)**.
