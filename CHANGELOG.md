# Changelog

All notable changes to this repository are recorded here. `data/gerbil_atlas.json`
carries a `version` block naming the release its derived fields were built for.

## [Unreleased]

### Changed
- **The publication floor comes down to the face floor, and 40 regions the atlas draws are
  published for the first time.** `MIN_AREA_PX` was 600 page px against a `MIN_FACE_PX` of
  400, so the extraction spent one test deciding a face was a region rather than tracer
  noise and a second test throwing away a third of what it had just accepted. The cull was
  written for watershed slivers -- a pixel-wide tongue of one region running along another's
  edge -- and it was also taking whole faces sealed by ink and seeded by a single printed
  label. **51 of those, 13 of them a structure's only claim on its plate.** The two floors
  are now equal, so the cull takes the slivers it was written for and nothing else.

  Nothing is lost by it: **40 (plate, region) entries arrive and none go**, and
  `structure_plate_entries` goes 3,078 to 3,118. The fornix is the case that prompted it --
  `f` is drawn on both hemispheres of plates 30 and 31 now, where 31 had no area at all and
  30 had only the right side, and its faces there are 470 to 487 px against the 674 to 737
  the same bundle measures on 29 and 32. `Obex` gains area for the first time anywhere: its
  only territory is a share of the face it, `IB` and `sol` seed between them on plate 57,
  and that share was cut every time. So the structure and mesh count goes 690 to 691.

  Three of the run's own verification numbers say the same thing from other directions.
  `label_inside_its_own_region` goes 0.9721 to **0.9776** -- more printed words now stand in
  the region they name, because the region exists. `section_area_residual_worst_plate` goes
  0.024 to **0.0101**, the ground those 40 entries hold having come out of the unassigned
  remainder. And `tools/leaders.py` reports 194 leader tips landing in the region their label
  names where it reported 177: seventeen of them were sitting in the middle of a face too
  small to publish. `boundary_edges_shared_exactly` stays 1.0.

  What it costs is drawn borders. A small face carries proportionally more of the watershed's
  invented wall, so `entries_without_a_drawn_outline` goes 293 to 316 and the traced-fraction
  shares slip -- `ge_90` 0.811 to 0.804, `ge_75` 0.904 to 0.898, `lt_50` 0.029 to 0.033. That
  is the honest price of publishing a region the atlas draws and letters: it is drawn less
  well than a big one, and it is now drawn.

  The figures that follow: polygons 5,905 to 6,012, points 167,610 to 168,740, the coloring
  691 regions in 631 patches with 78 joins holding and 27 refused against 105 candidates, and
  touching pairs 4,464 to 4,509. METHODS takes all of them. Its `w` paragraph quoted 1,551
  entries "that share a face at all" against no committed script; since the entry count moved
  it is restated as the 1,529 whose seed lands in a face another name seeds too, which is a
  definition that can be recomputed. The `TIP_READ` note in `tools/label_leaders.py` that had
  `E` keeping no entry on the left of plate 2 says what the floor did and what it does now --
  that bead is published, and `E` has one.

### Fixed
- **The right VMHSh on plate 30 gets its shell back.** The atlas prints both `VMHSh` words
  clear of the section and draws each a line up into the shell of the ventromedial nucleus.
  The leader pass followed the right one to within two pixels of that shell and stopped on
  the wrong side of its wall -- the failure `TIP_READ` in `tools/label_leaders.py` exists
  for, where a region narrower than the skirt the tracing is masked with swallows the last
  stretch of the line. So the tip seeded the undivided hypothalamic face that `MTu`, `PLH`,
  `PTe`, `PeF`, `PeFLH`, `TuLH` and `f` share, and the shell -- the 3,404 px mirror of the
  4,487 px face the left tip lands in -- was left unnamed.

  A row of `seed_overrides` moves the seed five page pixels, off the wall and into the shell.
  **`VMHSh` on plate 30 goes 0.2771 to 0.4188 mm2**, and the right side of it 0.0392 to
  0.1809 against the left's 0.2379, where plate 31 draws 0.2753. Its traced share on that
  side goes 0.966 to **1.000**: the outline it stops at now is one the atlas printed, every
  pixel of it. `MTu` gains 0.0378 mm2 of the block the two were splitting, and the other nine
  entries that move do so by 0.0031 mm2 or less. In the meshes `VMHSh` comes out as one
  component rather than two.

  Eleven (plate, region) entries move, all on plate 30. `boundary_edges_shared_exactly` stays
  1.0, `structure_plate_entries` stays 3,078, the coloring is unchanged at 690 regions and
  633 patches, and points go 167,565 to 167,610. `tests/python/test_leaders.py` records one
  more tip sitting in a neighbour -- 177 in their own region, nine in a neighbour, 54 in
  none -- which is what a superseded tip looks like from the outside: the extents no longer
  follow it, so it is left where the march stopped.

### Fixed
- **The right MCPC on plate 33, and the zonal layer on 35, 37 and 38: four words printed on
  the ink of the thing they name.** A label is seeded where its word is, and where the word
  falls on a boundary rather than inside a face `locate()` has nothing to seed and snaps to
  whichever face fills most of the sixty pixels around it. That is a documented fallback and
  usually harmless -- 192 labels take it, most on the olfactory bulb plates where the section
  is small. These four are the case where it costs a structure a hemisphere.

  `MCPC` is printed across the boundary of the magnocellular nucleus rather than beside it,
  so the right-hand box centre lands on the ink and was snapped out into the tegmental field
  `TG` is printed in. MCPC then held 0.7232 mm2 of that field -- four and a half times its
  own left-hand nucleus, and reaching laterally past `APTV` to `REth` -- while its own
  nucleus, the 2,396 px mirror of the 3,114 px face the left-hand word seeds, sat unnamed.
  A row of `seed_overrides` puts the seed 8 px inside that face. **`MCPC` goes 0.8824 to
  0.2824 mm2** and comes out symmetric, 0.1231 on the right against 0.1592 on the left,
  where plate 34 draws 0.1541 and 0.1601; **`TG` goes 1.0766 to 1.7984** and comes out
  symmetric too, 0.9028 against 0.8956, where it had been 0.1809 against 0.8956. Both traced
  shares rise with it, MCPC's right 0.905 to 0.976 and TG's 0.854 to 0.982: the outline they
  now stop at is one the atlas printed.

  `Zo`, the zonal layer of the superior colliculus, is the same failure, and once one of them
  turned up the layer was read across all nine plates it is drawn on rather than the three
  the scan first returned. The lamina is one or two pixels of section between the pia and
  `SuG`, and the atlas letters it on the lamina, so wherever the box centre lands on the ink
  the seed is snapped into a neighbour and the arc goes unnamed. **Plate 35 goes 0.4403 to
  0.8186 mm2, 36 0.5120 to 0.9033, 37 0.4385 to 0.8593, 38 0.3218 to 0.6415 and 39 0.4583 to
  0.7120.** What those rows recover was unassigned ground, so no region loses by it: `SuG`
  gives up between 0.006 and 0.012 mm2 a plate, `RSGa` gains 0.014 on 35, and nothing else
  moves by more than a thousandth and a half.

  Plate 39 needed the first seeds of their own this database has -- rows with no
  `label_index` beside them. Its left lamina is cut into three faces and one printed word can
  seed only one, so the other two are named by a seed apiece, which is the case
  `tools/corrections.py` describes as the box being fine and a face simply unlettered. The
  four plates that needed nothing are worth naming too: on 33 and 34 the lamina is one arc
  across the midline, which a single seed names entire, and on 40 and 41 both words already
  seed it -- what sits unowned beside them there is the cerebellum, the outer cortical
  surface and one-pixel slivers of rim, none of it zonal layer.

  What no seed can fix is the right of 36, 38 and 39. There the tracing does not separate
  `Zo` from `SuG` and `Op` at all: the three share one face of 17,000 to 26,000 px and the
  watershed splits it along a line the atlas never drew. That is a missing run of boundary
  rather than a seed in the wrong place, it wants the printed page to place, and it is left
  as it is and said so in the `seed_overrides` note.

  In the meshes `Zo` goes 1.2505 to 2.1875 mm3; `TG` goes 1.4823 to 1.8173 and `MCPC` 0.4070
  to 0.2499. `RSGa`'s worst traced share goes 0.92 to 1.00.

  Forty (plate, region) entries move, all on those six plates, and every one of them outside
  the seven named above by 0.0138 mm2 or less. `boundary_edges_shared_exactly` stays
  1.0 and `structure_plate_entries` stays 3,078 -- no structure gained or lost a plate.
  Four adjacencies go with the corrected outlines, 4,468 pairs that touch to 4,464, and
  METHODS' vertex and near figures follow it, as do polygons at 5,905 and points at 167,565.
  The coloring is unchanged at 690 regions, 633 patches, eight colours.

  How the other three were found: `tools/leaders.py --odd` is the leader half of this
  question, and this is the seed half. Every plate was rebuilt and, for each of the 2,132
  (plate, region) entries the atlas letters on both hemispheres, the left and right areas
  compared, with `locate()` replicated on every printed box to see which fall on ink. Ninety-
  five labels snap; a snap on its own is not a fault. The signature that is one is a snapped
  box with an **unowned** face beside it whose size and place mirror the face the other
  hemisphere's word seeds, and only these four have it. The bulb plates are the documented
  fallback and were left alone; `IntDL` on 47 snaps into the seventeen-name cerebellar block,
  which is a `w` entry and an estimate by design; `CA1` on 33 and 34, `VP` on 18 and `sol` on
  54 are lopsided with no unowned face within reach, so whatever ails them is not this and
  they are left for a diagnosis of their own.

### Added
- **Every leader in the atlas, and the label it was drawn from, as one command.**
  `tools/leaders.py`. Where a region is too small or too crowded to hold the word that names
  it, the atlas sets the abbreviation outside and draws a thin line to the place it means;
  `tools/label_leaders.py` read those lines off the printed page and wrote their far ends into
  `label_leaders`, and until now that block was only readable as 47 lines of JSON keyed by
  plate, or as three columns of `data/gerbil_atlas_labels.csv` -- the tip's two fractions and
  a `position_from` saying which end a row's coordinate came from -- which is enough to filter
  on and not enough to read: nothing there says how long a line is, which labels share one, or
  what either of its ends sits in. This reads the block back out: a row per leader, with the
  label it belongs to, both of its ends in stereotaxic millimeters, and which region each end
  falls in.

  A leader is one drawn line, and the block records it against every name in the label it was
  drawn from -- `E/OV` on plate 3 is one line and two entries, because the atlas typeset the
  two names as one label. So the rows are labels, 240 of them, and `line` is what says which
  of them are the same line: 219 lines, 21 of which two names share. Two lengths are quoted,
  because they answer different questions: the line as printed, from the edge of the word to
  the tip, and how far the label's recorded position moves once the line is followed, which is
  what the seed, the coordinate the app quotes and the point a planner aims at all shift by.

  Where an end falls is answered exactly as the app answers a click -- the plate's extents,
  even-odd, at the point itself -- so the row says what the line cost and what it bought:
  `VMHSh` on plate 30 is printed in an unassigned face and lands in `VMHSh`. `--odd` is that
  question asked as a filter, and it is what found the three misread marks fixed below:
  eight tips now sit in a neighbour's ground -- five of them names that are no region at all,
  three of them superseded -- and 54 in an unassigned face or in an outline too thin to hold
  the point that seeded it. `--shared`, `--abbr` (a
  name, or one of the atlas's own aliases), `--plates`, `--min-mm` and `--sort length` are the
  rest of the filters, and `--csv` and `--json` write the same rows flat.

  It derives nothing and writes nothing into the database: it is `label_leaders` put the way a
  reader asks for it. So it needs no PDF, unlike the pass that produced the block, and no
  numpy either -- the database and the standard library are the whole of it. The arithmetic is
  held to the pass's own by tests: the longest line among those no label shares comes back as
  the 1.231 mm `label_leaders.summary` recorded, and the median gap of 0.57 mm and the 47 of
  240 over a millimetre are the two figures METHODS publishes.

  `tools/README.md` also had `label_leaders.py` finding 212 labels where the committed block,
  METHODS and the tests all say 240.
- **The meshes take a transparency and a coloring, and the coloring can be the plate's
  own.** Two controls under **Advanced**, one 3-D pane at a time. **Opacity** runs from a
  glass shell to solid bone; **Color** says what decides a mesh's color.

  The picture that asked for both is a division. Its members were drawn in the division's
  one color -- right for a structure, whose parts are parts of a thing, and wrong for the
  cortex, where sixty-five meshes in one teal make a blob that will not say which field you
  are looking at or where one stops. **Plate colors** is the answer that was already in the
  repository: `region_colors`, the slot each region wears on every plate it is drawn on,
  solved once over all 62 plates so that no two regions that touch on a plate are alike. The
  3-D view now reads that same table rather than solving anything of its own, so a structure
  is the color in the stack that it is in the section under it, and the two views are one
  picture. What a color means is what it has always meant here -- "not my neighbor", and
  nothing else; and since the solve was over adjacency on a plate, two meshes that meet only
  across the 350 um between sections can come out alike, which METHODS now says. **One per structure** is the third answer: a hue off each name, more colors than
  eight, promising only that they are told apart.

  Opacity is the other half of the same problem, since a solid shell of cortex hides
  everything the cortex contains. At the top of its range the meshes take the pass they
  always took -- depth-tested, depth-writing, nearest surface wins. Below it they are
  composited back to front by their own centers and stop writing depth, which is the whole
  of what lets a structure inside another show through it, and the tissue behind show
  through both.

  Both belong to a pane, so a split can hold the solid picture beside the transparent one,
  and both ride in the link -- `mo` and `mc`, beside `mh` and only when they are off their
  defaults, so every mesh link ever written still opens on exactly the mesh it was written
  for. The count on **Advanced** covers them, a link carrying either unfolds it, and the
  note under the picture says what was done: a render that has been made translucent or
  recolored is one the reader cannot see the settings of from the picture.

- **The fixer links to the guide.** **Guide** in the header of `fixer.html` opens
  *Correcting a Region* on the wiki -- what a correction actually corrects, what each of the
  five tools is for, how to read what **Pick** says about a face, and what happens after a
  correction is sent. It is also linked from the panel where the tools are first explained,
  and named in the notice the published page shows in place of **Inspect** and **Recut**.

  On a phone the link cost the plate a row of the header, which is the room that page was
  tuned to keep: the title and the link give up their words there -- *Region fixer* and
  *?* -- and the header is two rows again at 390&nbsp;px with 43&nbsp;px to spare rather
  than 4 over. A test holds it to that, on the phone as on a desktop.

- **The fixer is on the site now, and in a Codespace, so correcting a region needs no
  clone.** `fixer.html` is the same page `tools/atlasfix.py` serves, built into the site by
  `build_app.py` with its stylesheet and script inlined. Opened from GitHub Pages it has no
  server behind it at all: it draws from what the site already publishes -- the database,
  the tracings in `svg/`, the plate images -- takes the same three marks, and writes
  `corrections/<id>.json` on a branch `correction/<id>` through the GitHub API with a
  fine-grained token the reader supplies, which starts the same workflow. Which of its two
  backends a copy is using it settles for itself, from a marker the local tool writes into
  the page it serves.

  **Pick** is the part that could not be faked. Saying which face a point falls in, how big
  it is and which printed labels seed it is `build_region_extents`'s cut of the plate, and a
  copy of that cut written in JavaScript would drift from the pipeline the first time
  `BRIDGE_PX` or `MIN_FACE_PX` moved. So the cut is published instead:
  `tools/build_facemaps.py` writes `data/facemaps/plate_NN.u16.gz` -- the face of every page
  pixel, gzipped, 23 to 100 KB a plate and 3.4 MB for all 62 -- with the face each printed
  label seeds beside it, and CI checks the committed maps are a fresh cut of the tracing.
  What the page reads is the extraction's own answer. `tests/js/fixer.spec.js` drives the
  published page and the local one against one point and asserts the two reports are the
  same string, and against one draft and asserts the two correction files are the same
  document.

  What the published page cannot do is run the pipeline, so **Inspect**, **Recut** and **QC
  image** are off and say why rather than failing; the session that applies the correction
  runs them and reports in the pull request. To get them back without a local clone there is
  `.devcontainer/`: a Codespace with the pinned packages, Node and port 8770 forwarded, where
  `python3 tools/atlasfix.py 19` is the whole tool -- Recut included, pushing with the
  Codespace's own credentials, and reachable from a phone through the forwarded URL.

  The site build gained what the page reads: `svg/`, `data/facemaps/` and `data/geojson/`
  are copied into it, and `build_app.py --check` now covers `fixer.html` as it covers the
  other two pages, stamp and all -- because the page needs its build for more than a
  footer. `sw.js` caches everything under `data/` cache-first, names the cache for the
  build it was filled for, and drops it when a new worker activates; but only `index.html`
  registers that worker, so a reader who opens the fixer and not the atlas could be held on
  one from an older build and handed that build's database under this build's face maps --
  one plate drawn from two cuts, and nothing on the page to say so. The fixer asks for
  `data/` with the build in the query, which such a cache has never seen, so it misses and
  goes to the network; inside one build the query is stable and the cache still serves. The
  test puts a real worker from a made-up older build in control with that build's database
  poisoned in its cache, checks it does serve that to anything asking plainly, and then
  checks the page reads past it.
- **A wrong region can be marked in a browser now, with the extraction answering for
  itself.** `tools/atlasfix.py` serves one plate on `127.0.0.1` -- the drawing under the
  tracing, dashed where the atlas prints it dashed; every region's outline as it stands;
  each printed label with the line and tip where the atlas draws one -- and takes the three
  marks `matlab/AtlasRegionFix.m` takes: a seed for the name a face should carry, the run
  of boundary the tracing missed, the outline a region should have. **Commit** builds
  `corrections/<id>.json` in a temporary git worktree cut from `origin/main` and pushes the
  branch, so the checkout being read from is untouched and
  `.github/workflows/apply-correction.yml` starts on the same file it always did: same
  schema, same page frame, same id. It needs the pinned packages and nothing else -- no
  MATLAB, no Image Processing Toolbox, no license.

  What is different is where its answers come from. MATLAB is outside the repository, so to
  say what a mark would do it has to re-implement the extraction -- its own rasterizer, its
  own bridging, its own watershed -- and that copy drifts from the pipeline the moment a
  constant moves. This one runs inside the repository and calls it. **Pick** cuts the page
  into faces with `build_region_extents`'s own rasterizer over its own `BRIDGE_PX`, and says
  which face a point falls in, how big it is, which printed labels seed it and which region
  holds the point today. **Recut** goes the whole way: it runs `corrections.apply` and
  `build_region_extents.build_plate` against a scratch copy of the plate's SVG and a copy of
  the database in memory -- the two calls the workflow makes -- and draws the outlines that
  come back, naming every region whose area moved. So what a reader looks at before
  committing is what the pipeline writes after, rather than an estimate of it, and the
  working tree is not touched either way. `tests/python/test_atlasfix.py` holds it to that:
  the page's face map is `build_plate`'s face map, pixel for pixel.

  Because the interface is a page, it is also the first way to mark a plate from a phone.
  A tap does what a click does, a drag pans, two fingers pinch, and a boundary is finished
  from a bar on the plate rather than with **Enter**, so every mark can be made with a
  thumb; the panel becomes a sheet with one bar left up, which leaves the plate three
  quarters of a small screen instead of a third. The server still has to run on a machine
  with the repository on it -- cutting a plate is the pipeline, not JavaScript -- and
  `--host 0.0.0.0` puts it on the network for the phone to reach. Bound past loopback the
  port is reachable by anything on that network and this thing pushes branches, so the URL
  it prints carries a key minted for the run and nothing without it is answered.

  The page is `src/fixer.html`, `src/fixer.css` and `src/fixer.js`, served by the tool and
  built into neither published page; `tests/js/fixer.spec.js` drives it in CI, on a desktop
  window and on a phone, which is why the browser job now installs `tools/requirements.txt`.
  The MATLAB class stays as it is, for anyone already in MATLAB.
- **A region drawn wrongly can be corrected from MATLAB, and the correction becomes a pull
  request on its own.** `matlab/AtlasRegionFix.m` brings a plate down from the site -- the
  drawing, the tracing, the extents as they stand, the printed labels and their lines --
  lays them over each other in millimetres, and lets a reader mark what is wrong: a seed
  for the name a face should carry, the run of boundary the tracing missed, the outline a
  region should have. `preview` cuts the plate into faces the way the pipeline does and
  says which one each seed lands in, before anything is sent; `commit` writes the marks to
  `corrections/<id>.json` on a branch `correction/<id>` and pushes it, through a clone or
  through the GitHub API. `.github/workflows/apply-correction.yml` then hands the file to
  a Claude Code session that follows `.claude/skills/atlas-region-fix` -- reads the
  correction against the extraction with `tools/corrections.py inspect`, fixes the input
  at fault with `apply` or by hand, rebuilds, runs every check, writes it up -- and merges
  the pull request once CI is green.

  Nothing is drawn into `region_extents` by hand: a correction is one edit to a pipeline
  input, and the extents are re-cut from it, so the regions still tile. The one new block
  is `seed_overrides`, a seed placed by hand that stands in for a printed box as a leader
  tip does, or seeds a face beside the printed labels; it is read after `label_leaders`
  and survives every re-run. A boundary from a correction goes into the plate's SVG as
  cubics with collinear control points, the one grammar `build_region_extents.flatten`
  reads, marked `data-correction` with the file it came from. With the block empty, all 62
  plates re-cut byte for byte; replaying the `S1DZ` case of #77 from its correction file
  against the tracing as it was gives the region back at 0.62 mm2, its mirror's measure.

### Changed
- **The 3-D view opens on the Nissl.** It opened on the labeled drawing, which is the right
  first sight of a *plate* and the wrong one of a *stack*: the drawing is ink on white, and
  62 sheets of contour lines and printed abbreviations ray-march into a haze with a brain
  somewhere inside it. The Nissl is tissue, which is what a volume is made of — density
  reads as density — so the stack now comes up looking like a brain. The plate view still
  opens on the drawing, which is the pairing having two views is for, and either can be
  switched in one tap.

  The link follows: `ps3` is written where the stack is off its own default, or where the
  plate is named and the stack is something else, and stays out where the link already says
  what the stack is. A link written before the stack had a source of its own still sets both
  from `ps`, exactly as it always meant.
- **Which controls stand in the bar is decided by room, not by screen size.** The viewpoint,
  **Split**, **A**/**B**, **Lock** and **In frame** moved into the panel below 900&nbsp;px
  and stayed in the bar above it — but a 1440&nbsp;px window with the search column open
  gives the 3-D bar 638&nbsp;px for 648&nbsp;px of controls, and ticking **Split** adds a
  further 110. So a breakpoint alone left **A**/**B** and **Lock** past a silent right edge
  on the width most people read this on. The group is measured against the room now: it
  hands itself to the panel on the first pixel of overflow and comes back with six to spare,
  so a window dragged across the line does not flap.

  The bar itself is one row at every width as a result. In the 3-D view it was 80&nbsp;px at
  1440 and 117&nbsp;px at 1280 — two and three rows, the icon group shouldered onto its own
  — and is 47&nbsp;px at both now. A flex container collects its items into lines *before* it
  shrinks any of them, so a strip left free to wrap never gets the chance to scroll; the
  strip no longer wraps, and it takes the free space instead.
- **The 3-D strip fits a phone now, instead of running off the edge of it.** It carried
  590&nbsp;px of controls in a 368&nbsp;px row, so most of it was reachable only by scrolling
  sideways. Two changes, each where it earns its keep: the render mode — Contours / Volume /
  Labels — becomes a menu below 900&nbsp;px, which is 195&nbsp;px of buttons for 81 and suits
  a choice you make once rather than one you flip; and the viewpoint, **Split**, **A**/**B**,
  **Lock** and **In frame** move into the panel at that width, because a control past the
  right edge of a row is worse than one behind a button that says *Controls*. The nodes are
  moved rather than copied, so there is only ever one of each and its state comes with it.
  All three views now fit exactly: plate, projection and 3-D each need no scroll at all.

  The staining switch stays a row of buttons at every width. It is the one you flip back and
  forth to read the same level two ways, and that is worth one tap and being able to see what
  you are switching to — the rest is what gave way to make room for it.

### Fixed
- **Su3 gets its right-hand ring back on plate 39, and DMSp5 its half of the trigeminal
  blob on 51.** Three of the 240 lines in `label_leaders` are not lines. The atlas draws a
  leader only for a word it could not fit inside the region it names; `4Sh` and `4N` on the
  right of plate 39 and `Sp5O` on the left of 51 are each printed *inside* the region they
  name, exactly as their mirrors on the other hemisphere are, so there was nothing for a
  line to do. What the pass followed out of each is a mark near the word -- long enough and
  straight enough to clear `MINTIP` and the shape tests, and running into the neighbour
  above.

  What that cost was a whole structure on a hemisphere. `Su3` is lettered once on plate 39,
  so the right-hand ring had nothing but its mirror to claim it with, and `4Sh`'s tip was
  sitting in it: `Su3` held 0.1031 mm2 where it should hold both rings, and `4Sh` held the
  Su3 ring on top of its own. `DMSp5` had no area at all on that hemisphere of plate 51,
  because `Sp5O`'s tip had taken it. `4N`'s mark ends under `DRV`, outside every ring the
  label could name, and cost only its own seed.

  A row of `seed_overrides` withdraws each marched tip and puts the seed back on the printed
  word -- `report-p39-4Sh-4N` and `report-p51-Sp5O`, three rows, fourteen now. On plate 39
  `Su3` goes 0.1031 to 0.2023 mm2 and `4Sh` 0.2307 to 0.1322; on 51 `DMSp5` goes 0.1226 to
  0.2751 and `Sp5O` 0.4254 to 0.2733. Both transfers conserve to within 0.0004 mm2: the
  ground moved, none of it was lost. Thirteen (plate, region) entries move in all and every
  other one of them by 0.0011 mm2 or less, all on those two plates; nothing moves anywhere
  else in the atlas. `boundary_edges_shared_exactly` stays 1.0 and
  `structure_plate_entries` stays 3,078 -- no structure gained or lost a plate, they
  exchanged ground on one. `labels_on_a_leader` goes 240 to 237, which is the count that
  records the fix. On top of the `PN/PIF` rebuild below, polygons go 5,902 to 5,904 and
  points 167,276 to 167,299; nothing on plate 36 moves.

  In the meshes `Su3` goes 0.2876 to 0.3341 mm3 and its centre moves back onto the midline,
  ML -0.04 to +0.02; `DMSp5` goes 0.5371 to 0.6790 mm3 and drops from three components to
  two, because the half that was missing rejoins the rest. `4Sh` goes 0.0734 to 0.0510 and
  `Sp5O` 0.7294 to 0.6388. Twenty-eight structure rows move in the table; the other
  twenty-four are neighbours on plates 38-40 and 50-52 whose interpolated volume shifts by
  a thousandth or two, which is what a change on one plate does to the levels either side.
  In `region_colors` nothing is recoloured -- 690 regions, 633 patches, eight colours --
  and one adjacency goes with the ring, 4,469 pairs that touch to 4,468. METHODS' vertex
  and near figures go with it: 4,215 pairs share a vertex somewhere and 253 never do, 538
  occurrences over the 62 plates, and 54 of the 253 would be painted alike on the vertex
  test alone. Eight colours with the near rule and without it, as before.

  These three were found by `tools/leaders.py --odd`, and they are why it now reports eight
  tips in a neighbour's ground rather than five: a withdrawn mark still sits where it always
  sat, and the region it used to take is no longer drawn around it. The tool's
  `superseded_by` column is what tells the two apart. The other 59 the filter returns were
  read and left alone. Five are fissures and their kin, which are no region to land in.
  Most of the rest are structures the drawing does not enclose -- `aci` on 8-9, `eml` on 28,
  `VMHSh` on 29 seed a face several names share, which is a tracing question and not a
  leader one -- and three (`I` on 23, `LVPO` on 44, `RPa` on 58) land dead centre in a face
  they solely own that is simply under the 600 px `MIN_AREA_PX` publishes. The `E`/`OV` lines on the bulb plates are the honest outcome `TIP_READ` already
  records and were not touched.

- **`PN/PIF` on plate 36 follows the lines the atlas draws from it, and `PBP` gets the
  ground it was printed in.** Two words, two lines, four rows, and a leader pass that
  recorded neither line.

  The atlas prints `PN/PIF` once per hemisphere on plate 36, in the dorsolateral wedge of
  the ventral tegmental area, and draws a short line from each word down and medially into
  the collar of gray around `IF`. `label_leaders` has no entry for the plate: both lines
  are 15 to 17 plate px long, which is under what the leader march will follow, so neither
  was found -- the same miss as `CeCv` and `9/11N` on plates 59-62 (#92). With no tip, the
  four boxes seeded where the words are, which is the face `PBP` is printed in, and the
  watershed split that face between the pair and `PBP` along a line the atlas does not
  draw. `PN/PIF` came out as the whole dorsal wedge -- 0.4801 mm² over two polygons, 11%
  of the border of each inferred -- and `PBP`, whose own label sits in the same face,
  was left with the ventrolateral band.

  Both lines were read off the plate the way the leader pass reads one: the ink that is
  neutral-dark where the tracing is red, straight over its whole length, running out of a
  located label. The left runs (491, 456) to **(507, 462)** in plate pixels, the right
  (553, 455) to **(539, 461)**, and each ends in the collar beside `IF`. That is four rows
  of `seed_overrides`, its eleventh through fifteenth -- two names to a label, because the
  atlas typesets `PN` and `PIF` as one and draws the line from the whole of it, so it is
  recorded against every name in it, as `label_leaders` does for `E/OV`. No box moves.

  **`PN/PIF` goes 0.4801 to 0.1104 mm²** and is the collar the lines point into: 0.0763 on
  the left at traced share 0.989, where the drawing seals that ground as a face of its own
  and the pair now takes the whole of it, and 0.0341 on the right at 0.871, where it does
  not and the watershed still has to place the ventral edge. **`PBP` goes 0.8093 to 1.2538
  mm²** -- 0.3928 to 0.6070 on the left and 0.4165 to 0.6468 on the right -- and its traced
  share goes 0.941 to 0.995 and 0.933 to 0.974, because the boundary it now stops at is one
  the atlas printed rather than one the watershed drew. `PIF` still has no entry of its own
  here: it shares the pair's, filed under the name the label leads with, which is what
  `label_blocks` means.

  **Only plate 36 has an entry that changes.** Eight others on it move, none by more than
  0.53 plate px (9 µm) or 0.0018 mm²: `vtgx`, `IF`, `fr`, `RMC`, `ml`, `mp`, `SubB` and
  `MGM`, which is a new junction changing how a shared arc simplifies. Three adjacency
  pairs go (`PN`-`PaR`, `PN`-`RMC`, `PN`-`ml`) and two arrive (`PBP`-`vtgx`, `PN`-`mp`), so
  the touching pairs go 4,470 to 4,469 -- and `region_colors` still comes back **identical**,
  all 690 slots, the solve landing where it landed. `boundary_edges_shared_exactly` stays
  1.0 and `regions_partition_the_volume` still asserts. No label was added or moved, so the
  label counts and the structure count stand.

  In the volume `PBP` gains 0.1980 mm³ (1.1835 to 1.3815) and `PN` loses 0.0641 (0.1454 to
  0.0813) -- and **comes out in two mesh components where it was in three**. That is the
  point of it. `PN` is a slab over plates 36 and 37, and on 37, where the atlas prints the
  name on its own with a line of its own that the pass did read, it sits ventromedially at
  ML -0.47. The plate-36 wedge was 0.0595 mm³ at ML -0.55 and the plate-37 piece 0.0320 at
  ML -0.47, and the two did not meet; the collar is where the line points, so they are one
  piece of 0.0711 now. The third, 0.0539 mm³ at ML +0.60, was the right-hand wedge; the
  right-hand collar is 0.0101 and stays its own piece, the atlas printing no `PN` on the
  right of 37 to join it to. Twenty other structures move by under 0.036 mm³ apiece, from
  the interpolation between plates 35 and 37 reading the corrected plane.

  One consequence is meant to look like a regression and is not, and it is the same one
  `S1DZ` and both `MA3` have. Pointing at either printed `PN/PIF` on plate 36 now answers
  `PBP`, because that is the region the atlas sets the words in; `label_inside_its_own_region`
  goes 0.9733 to 0.9727 for those four labels. METHODS' end-to-end paragraph counts the
  labels that answer with another name and it goes 21 to 23 -- the two `PN` boxes are new
  there, and the two `PIF` boxes were already counted, having answered `PN` before and
  answering `PBP` now; so the compound-label share of that count goes 14 to 12 and the
  set that is supposed to answer elsewhere goes 3 to 7.

  Counts. Nothing about the label pass moves. In METHODS, points go 167,255 to 167,276 and
  the touching-pair figures 4,470 and 4,220 to **4,469 and 4,219**, the 250 that never share
  a vertex and the 535 plate-by-plate occurrences unchanged.

  Reported from the plate view. The rows carry `report-p36-PN-PIF` as their id, there being
  no correction file to name.

- **`MA3` on the left of plate 35 keeps to its own column now, and `InC` gets back the
  ground the watershed took to draw it with.** The same failure as the right-hand `MA3` on
  plate 34, on the other hemisphere of the next plate, and found by looking for it.

  The medial accessory oculomotor nucleus is a pair of narrow paramedian columns, and the
  atlas cannot fit `MA3` inside one: it sets each word beside its column. On plate 35 the
  left-hand box is centred at (0.4559, 0.5912), which is plate pixel (501.5, 415.6); at
  that height the column it names runs from x 503 to 513, so the centre sits **a pixel and
  a half short of it**, inside the face `InC` letters. A box seeds the face its own centre
  pixel falls in, so the watershed split `InC`'s face and gave `MA3` a blob around its own
  word -- 0.0658 mm² with a quarter of its border invented -- while the column itself,
  1,661 page px against 1,863 for its mirror on the right, was left unlettered.

  This is the eleventh row of `seed_overrides`, and the second `MA3` has needed. `[0, 0.4618, 0.5912]` stands in for the left-hand box exactly as a leader
  tip does, on the column's midline at the word's own height. The box does not move: it is
  where the word is printed, which is all it ever claimed to be.

  **The left-hand `MA3` goes 0.0658 to 0.0882 mm² and its traced share 0.757 to 0.994**,
  against 0.0971 on the right, so the two hemispheres now measure within 0.0089 mm² of each
  other where they were 0.0313 apart. **`InC` on the left goes 0.1911 to 0.2530 mm² and its
  traced share 0.856 to 0.997**, against 0.2592 on the right, within 0.0062 where it was
  0.0681: it takes back the whole 0.0619 mm² the watershed had carved out of it, and
  99.7% of its border is printed ink where 86% was. Over the atlas `MA3` goes 0.356 to
  0.379 mm² and `InC` 1.405 to 1.466, and the worst traced share either of them carries
  anywhere goes 0.76 to 0.98 and 0.86 to 0.99. Plate 35 goes from 28 polygons of unassigned
  ground to 27 and from 88 faces lettered by one abbreviation to 90 -- the column becomes
  one, and `InC`'s face stops being shared.

  **Only plate 35 has an entry that changes.** Five others on it move, none by more than
  0.58 plate px (10 µm) or 0.0013 mm²: `PrEW`, `PBP`, `PaR`, `LPAG` and `Dk`, which is a new
  junction changing how a shared arc simplifies. `region_colors` comes back **identical**,
  all 690 slots: `MA3` and `InC` touched on the plate before and touch on it now, so no
  pair of names that touch is new and there is nothing for the solve to repaint.
  `boundary_edges_shared_exactly` stays 1.0 and `regions_partition_the_volume` still
  asserts.

  In the volume `InC` gains 0.0235 mm³ (0.6180 to 0.6415) and keeps its four components.
  **`MA3` loses 0.0057 mm³ (0.1800 to 0.1743) while gaining area**, and that is the point
  rather than a cost: it is a slab between plates 34 and 35, and the blob on 35 sat 13 px
  lateral of the column on 34 -- centres at x 494.7 against 508.1 -- so the interpolation
  between them swept a band neither plate draws. The centres are 508.3 and 508.1 now, and
  the sweep is the column. Fifteen other
  structures move by under 0.003 mm³ apiece, from the interpolation between plates 34 and 36
  reading the corrected plane. One of them changes shape in a way worth naming:
  **`LPAG` comes out in two mesh components where it was in one**, the second being 0.0011
  mm³ -- 0.05% of it, nine voxels at 50 µm -- half a step in front of plate 35, which is the
  anterior edge of the only plane this change touched. Its polygon there moved by 0.44 plate
  px and the lattice pinched a crumb off the edge. It is a voxelisation artefact at the
  resolution the volume is built on, not a second piece of anatomy.

  One consequence is meant to look like a regression and is not, and it is the third of
  these. Pointing at the printed `MA3` on the left of plate 35 now answers `InC`, because
  that is the region the atlas sets the word in; `label_inside_its_own_region` goes 0.9735
  to 0.9733 for that one label. METHODS' end-to-end paragraph counts the labels that answer
  with another name, and it goes 20 to 21.

  Counts. Nothing about the label pass moves: no box was added or moved, so
  `label_positions_located`, `ocr_confirmed` and every per-plate count stay where they are,
  and so does the structure count at 690. In METHODS, points go 167,252 to 167,255. The
  touching-pair figures are reconciled rather than incremented, and most of that gap is
  #93's rather than this change's: the touching-pair figures under *Coloring the section* stood at "4,461
  pairs ... 4,210 ... 251" against 4,471, 4,221 and 250 on `main`, and this change takes
  them to **4,470, 4,220 and 250**. The one pair fewer is `MA3`-`PaR`: the blob reached far
  enough laterally to touch the pararubral nucleus and the column does not. No pair is
  new, which is why the coloring does not move. The 535 plate-by-plate occurrences are
  unchanged throughout.

  Reported from the plate view. The row carries `report-p35-MA3` as its id, there being no
  correction file to name.

- **`p1PAG` is drawn on plates 32-34 now, and `MA3` on the right of plate 34 is drawn on
  its own strip rather than beside it.** Two regions, two of the four causes, and one
  plate they meet on.

  **`p1PAG` had never been located anywhere.** The p1 periaqueductal gray is printed on
  plates 32, 33 and 34 -- once at the midline on the first two, twice on 34, where the
  atlas sets the word either side of the aqueduct -- and `label_positions` had no box for
  it on any of them. No box is no seed, so no area, no volume and no mesh, and the face
  the word is printed in was left unlettered. The reason it survived every pass is in the
  database already: `p1PAG` and `p1Rt` are set in italic, the only italics on any plate,
  and `tools/find_unlettered.py` composes a word it cannot cut whole out of glyphs taken
  from located labels -- so with no italic exemplar anywhere there was nothing to compose
  from. That is the one case that pass cannot reach in principle, and the answer is the
  same as for any word a pass has missed: measure it on the plate. The four boxes here are
  the ink bounding box of the word read off the plate drawing; the same measurement
  reproduces the committed box for `MA3` on plate 34 to 0.0000 in `cx`, 0.0003 in `cy`,
  0.0003 in `w` and 0.0005 in `h`, which is what says the convention is the one the label
  passes wrote. `p1Rt` is the other italic and is still unlocated; nothing here touches it,
  and `verification` now says which six structures are left with no label anywhere.

  **`p1PAG` on plate 32 comes out 1.4948 mm², on 33 0.7949 and on 34 0.8117** -- 3.101 mm²
  over the atlas, 1.0935 mm³, one mesh component, graded `surface`, centred at ML -0.02,
  DV -4.93, AP -3.32. Every one of the three is the periaqueductal collar as the atlas
  draws it: traced share 0.994, 0.982 and 0.996. The second ring on plate 32 is a hole --
  the sliver below the aqueduct that no printed name letters, which stays unassigned
  rather than being absorbed.

  On 32 and 33 that ground was nobody's: the plates go from 5.6055 to 4.1010 mm² and from
  4.2941 to 3.5093 mm² of unassigned ground. On 34 it came out of **`PrEW`, which had been
  holding the whole periaqueductal column** because it was the only name seeded in that
  face: 0.9061 to 0.1001 mm² on the plate, 0.994 to 0.188 over the atlas, 0.2564 to 0.0840
  mm³, and its centre drops from DV -5.15 to -6.07 -- onto the small ventral bulge the
  atlas prints the word inside. Its traced share goes 1.000 to 0.982, which is the honest
  number: the line between `PrEW` and `p1PAG` is 1.8% of its border and is the one piece
  of boundary here the atlas does not draw.

  **And the right-hand `MA3` on plate 34 was seeded outside its strip.** The atlas prints
  `MA3` twice, one word per paramedian column. The right-hand box is centred at (0.4836,
  0.6071), which is plate pixel (532.0, 426.8); at that height the column it names runs
  from x 520 to 529, so the centre sits three pixels clear of it, in the tegmental face of
  92,776 page px that `TG`, `VTAR` and `sumx` letter between them. A box seeds the face its
  own centre pixel falls in, so the watershed split that face and gave `MA3` a blob beside
  its own word -- 0.0716 mm² with 34% of its border invented -- while the column itself,
  1,805 page px against 1,885 for its mirror on the left, was left unlettered.

  That is a row of `seed_overrides`, its tenth. `[0, 0.4768, 0.6071]` stands in for the
  right-hand box exactly as a leader tip does, on the column's midline at the word's own
  height. The box does not move: it is where the word is printed, which is all it ever
  claimed to be. **The right-hand `MA3` goes 0.0716 to 0.0940 mm² and its traced share
  0.656 to 1.000**, against 0.0993 on the left, so the two hemispheres now measure within
  0.0053 mm² of each other where they were 0.0271 apart, and every point of both polygons'
  borders is on printed ink. The plate goes 0.1704 to 0.1933 mm², the atlas 0.333 to 0.356
  mm² and 0.1525 to 0.1800 mm³, still one mesh component. `TG` takes back the 0.0702 mm²
  the watershed had carved out of it -- 3.2144 to 3.2846 on the plate, 4.637 to 4.707 over
  the atlas, 1.4745 to 1.4824 mm³ -- and its right polygon's traced share goes 0.952 to
  0.963. Plate 34's unassigned ground goes from 24 polygons to 23; its count of faces
  lettered by one abbreviation stays at 110, because the right-hand column becomes one
  while the face `PrEW` had to itself is now shared with `p1PAG`. Plates 32 and 33 each
  gain one such face, 121 to 122 and 130 to 131, and 32 comes back in more unassigned
  polygons than it went in with, 26 to 30: `unassigned` records connected runs of ground
  no name holds, and those run through the ink between two unnamed faces, so the one blob
  that stretched from x 413 to 623 across the midline is five once `p1PAG` sits in it.

  **Nothing outside plates 32-34 has an entry that changes at all.** On those three, 31
  entries move besides the four above, and none of them by more than 1.44 plate px (25 µm)
  -- most by under half a plate pixel, which is `DP_PX`. That is naming a face that was
  unassigned: it puts new junctions on its neighbours' borders, and an arc cut in two
  simplifies differently from the same arc whole. In volume, 38 structures move by under
  0.035 mm³ apiece -- `3V` -0.0347, `Dk` -0.0329, `PVP` +0.0239, `pc` -0.0232 the largest
  of them -- which is the interpolation between plates 31 and 35 reading the corrected
  planes. No structure changes its number of mesh components.
  `boundary_edges_shared_exactly` stays 1.0 and `regions_partition_the_volume` still
  asserts. The structure count goes 689 to 690: `p1PAG` had never had a mesh anywhere,
  because it had never had an extent anywhere.

  One consequence is meant to look like a regression and is not, and it is the same one
  `S1DZ` had. Pointing at the printed `MA3` on the right of plate 34 now answers `TG`,
  because that is the region the atlas sets the word in; `label_inside_its_own_region`
  goes 0.9736 to 0.9735 for that one label. A word set outside the region it names is what
  `seed_overrides` exists to record, and the block's note names this row beside the nine
  already there.

  **The whole atlas repaints.** Ten adjacency pairs are new (4,461 to 4,471) and
  `region_colors` is one solve over all 62 plates: re-run, it lands on a different valid
  eight-coloring and 594 of the 690 regions take a different slot. Nothing about the
  coloring's guarantees moves -- eight colors and no fewer, 633 patches where there were
  632, 26 refusals, no two regions that touch on a plate alike; the asks granted go 120 to
  119, which is the solve landing where it lands. A slot has never meant anything beyond
  "not my neighbor", and it is not stable across a rebuild.

  Counts. In the database, `label_positions_located` goes 6,342 to 6,346 and
  `ocr_confirmed` 3,347 to 3,350, with `n_labels_located` and `ocr_confirmed` on plates
  32-34; all of it is `export_tables.py --refresh-db`. The literals in `tests/python` and
  `tests/js/colors.spec.js` follow, structure count included. In METHODS: entries carrying
  an area 3,075 to 3,078, the pairs the label pass located 3,212 to 3,215, polygons 5,898
  to 5,902, points 167,075 to 167,252, the coloring's 689 regions and 632 patches to 690
  and 633 and its asks granted 120 to 119, and every quotation of the label total.
  `verification`'s note gains the pass that read `p1PAG` and says which six structures are
  left with no label anywhere; the figures it opens on are the stale snapshot #92 named and
  are left as they are.

  The end-to-end paragraph and the outline-containment row are the snapshot #92 left alone
  for being one no committed script reproduces, and this change leaves their counts alone
  for the same reason -- METHODS now says so in the paragraph itself. One thing in it is
  not a count and could not be left: it enumerated the labels that answer with another
  name as four plus fourteen plus the right-hand `S1DZ`, "the only one that is supposed
  to". There are two of those now, so the enumeration goes 19 to 20 and names both.

  Reported from the plate view as `p1PAG` missing on plates 31 and 32; the atlas prints the
  word on 32, 33 and 34, which is where it is now drawn. The `MA3` row carries
  `report-p34-MA3` as its id, there being no correction file to name.

- **`9/11N` on plate 62 and `CeCv` on plates 59-61 sit at the end of the lines the atlas
  draws to them.** Seven printed words, eight boxes, one failure: the atlas cannot fit the word
  inside the region, sets it outside and draws a short line back in, and `label_leaders` has no
  record of that line -- so the seed stayed on the word. `9N` came out as a 0.2466 mm² blob around its
  own word, carrying `w` and holding ground that is `vsc`'s and `ts`'s; `CeCv` had no area at
  all on three of the seven plates the index lists it for.

  **`CeCv` had never been located either, which is why no line could have been marched to it.**
  The word is printed twice on each of plates 59, 60 and 61, lateral to the cell beside the
  central canal, and the label pass has none of the six. A leader is attached to a label by
  running the line back until it *reaches a box*, so with no box there was nothing to reach.
  The six boxes are added to `label_positions` -- the ink bounding box of each printed word,
  in the frame fractions the pass writes. That alone would not have helped: each of the six
  lines is 10 to 14 page px long and each tip sits 15 px from its own word, under the 20 px
  `MINTIP` asks before it will call a mark a line rather than a bracket beside the word.

  **So the eight tips are rows of `seed_overrides`, read off the plate.** That block is where
  a hand reading belongs: it stands in for the printed box exactly as a leader tip does, it is
  read after `label_leaders`, and it wins over a marched tip because it was read off the plate.
  `label_leaders` is `tools/label_leaders.py`'s own output against the page and is left to it.
  `9/11N` is one label of two names -- see `label_blocks` -- so `9N` and `11N` each take the
  one tip, as a leader is recorded against every name in the label it was drawn from. Its line
  is 32 px of black ink from the top of the word up into the ventral horn, cut in two where it
  crosses the outline it points into, with its tip 35 px from the box and so well past
  `MINTIP`; what the shape tests made of the two fragments is not answerable from the app's
  plate. Nothing else was touched -- no tracing, no outline, no leader -- and everything cut
  from those inputs was rebuilt.

  **Plate 62.** `9N` goes from one polygon of 0.2466 mm² carrying `w` to **two polygons of
  0.1474 mm² with every point of both borders on printed ink**, traced share 0.58 to 1.000 --
  one ventral horn per hemisphere, the left one from the mirror, since the atlas letters only
  the right and the face opposite is sealed and unnamed. `vsc` takes back the 0.152 mm² it was
  short (0.6765 to 0.8284) and loses its own `w` with it; `ts` goes 0.0433 to 0.1375. The plate
  goes from 7 unassigned faces to 5 and from 13 faces lettered by one abbreviation to 15.

  **Plates 59-61.** `CeCv` gains an entry on each -- 0.0725, 0.0736 and 0.1306 mm², every point
  of every border on printed ink. On plate 60 it is two polygons, one either side of the
  central canal, which the drawing cuts there as a face of its own; on 59 and 61 the canal is
  thinner than a face and the two sides come out as one polygon across the midline, which is
  the extraction's honest answer to a boundary the plate does not resolve. Regions per plate
  go 20 to 21, 18 to 19 and 19 to 20, faces lettered by one abbreviation 18 to 20, 14 to 16 and
  11 to 13, and plate 61 goes from 8 unassigned faces to 7.

  Nothing else on the four plates moves by as much as a plate pixel. Nineteen other entries do
  move -- `Cu`, `IB`, `dsc`, `pyx`, `rs`, `SolC`, `dcs`, `ts`, `vsc`, `mlf` and `MdV`, spread
  over the four -- the largest of them by 0.90 plate px (`SolC` on plate 60), which is the
  watershed re-solving beside a seed that was not there before. No plate outside 59-62 has an entry that changes by
  a point.

  Over the atlas `CeCv` goes 0.631 to 0.907 mm² and 0.1771 to 0.2878 mm³, drawn on five plates
  where it was on two and from nine located labels where it had three, still in two mesh
  components. `9N` goes 0.247 to 0.147 mm² and 0.0505 to 0.0388 mm³ and **comes out in two mesh
  components where it was in one** -- one per hemisphere, which is what a structure the atlas
  draws on both should be, and the single piece was the mistake. `vsc` gains 0.153 mm² and
  0.0372 mm³, `ts` 0.092 and 0.0198, `SolC` loses 0.011 mm² and gains 0.0070 mm³; eleven more
  structures move by under 0.01 mm³ apiece, from the interpolation reading the corrected
  planes. `boundary_edges_shared_exactly` stays 1.0, `regions_partition_the_volume` still
  asserts, and the structure count stays 689.

  **The whole atlas repaints, as it did for #88.** Five adjacency pairs are new on plate 62 and
  `region_colors` is one solve over all 62 plates: re-run, it lands on a different valid
  eight-coloring and 541 of the 689 regions take a different slot. Two of the joins it used to
  refuse are gone, both of them `9N`'s -- against `ts` and against `vsc` -- because the atlas
  does draw a boundary there and the extraction now has it: refusals 28 to 26, patches 631 to
  632, pairs that touch 4,456 to 4,461, pairs with no printed boundary 193 to 189. Eight
  colors, the fewest, no two regions that touch on a plate alike, and 120 asks granted, all
  unchanged.

  One consequence is meant to look like a regression and is not. Pointing at the printed
  `9/11N` on plate 62 now answers `vsc`, and at `CeCv` on 59-61 answers `MdV`, because that is
  where the atlas prints those words; `label_inside_its_own_region` goes 0.9750 to 0.9736 and
  the 3-D `labels_in_their_own_region` 0.9460 to 0.9447 for the same reason, both checks
  reading a box at the end of its *leader* and these seeds being `seed_overrides`.

  The left-hand `9/11N` on plate 62 is still not located, and is left that way on purpose. It
  is a compound token, and `tools/find_compounds.py` is what reads those off the page and
  decides which member holds which box; the mirror gives the region its left horn, so what is
  missing is the second word to hover, not the ground.

  `label_positions` goes 6,336 to 6,342 and the pairs it covers 3,344 to 3,347;
  `test_label_positions` and `test_labels_table_rows` carry those two literals and are bumped
  with them. Entries carrying an area go 3,072 to 3,075, polygons 5,893 to 5,898, points
  166,973 to 167,075, entries carrying `w` 295 to 293, mirrored seeds 121 to 123 and seeds
  placed by hand 1 to 9. METHODS is brought up to all of those and to the coloring's own
  figures, and gains a passage under *Where the name is not the place* saying which lines are
  read off the plate rather than marched to, and why each of these two was. Two figures there
  are left alone and named here instead: the "6,258 of 6,335" row in the volume table and the
  counts in the end-to-end paragraph are a snapshot no committed script reproduces, and both
  were already stale before this change.

  Reported against the plate view, `9/11N` on plate 62 and `CeCv` on 59-61. No correction file
  was written, so the rows name the report.
- **A point outside the brain in the 3-D label cloud, and it was never a label.** Plate 22
  carried a box for `3` -- layer 3 of cortex -- at ML +9.54 mm, on a plate whose section
  reaches +6.11. What was printed there is not an abbreviation: it is the rotated `m` of
  `[mm]` in the axis caption the atlas sets sideways up the right-hand margin, outside its
  own ruled coordinate box, read as a `3` by the label pass. A `3` is a name the atlas
  prints, so nothing downstream had reason to doubt it.

  It cost no geometry. A seed outside the section names no face, so the extraction had
  already refused this one -- it was the single entry in `labels_dropped`, and every
  polygon on the plate is byte-identical with the box gone. What it did was plot. Every
  located label is a point in the reverse lookup, the projections and the 3-D cloud, and
  in the cloud it hung in mid-air beside the brain, which is where a reader saw it. The
  plate had hidden it twice over: `3` has an extent there, and a structure with an extent
  is outlined rather than circled, so the box was never drawn; what it did drive -- a hover
  on the ruler answering `3` -- is a question nobody thinks to ask of the margin.

  **6,337 located labels become 6,336**, `labels_dropped` goes 1 to 0, and `3` loses 0.08 mm
  of the ML its label center is quoted at in the structure table (3.58 to 3.50, DV -7.29 to
  -7.31) -- the mean of 68 labels dragged by one that was 6 mm out. Nothing else moves: the
  extents, the volumes, the meshes, the coloring and the divisions are all unchanged.

  The rule it broke is now a test over the committed data: every label lies inside the
  printed coordinate box, `[10, 10.5, 1032, 692.5]` of the 1100 x 703 frame. The margin is
  wide -- the located labels run 118 to 906 px across and 125 to 608 px down -- so nothing
  genuine is near the lines, and anything out there is page furniture read as a name.

- **`S1DZ` on plate 18 was drawing its own label, and `S1J` was short the ground the
  watershed took to draw it with.** The dysgranular zone is a wedge a few pixels wide where
  it leaves `fmi`, too narrow to hold its own name: on the right hemisphere the atlas sets
  the word `S1DZ` below the boundary it names, in `S1J`. Two things had gone wrong there,
  and this is the first correction that takes two edits rather than one -- neither is any
  use without the other.

  **The tracing had lost the run of the `S1DZ`/`S1J` boundary the printed word sits over.**
  The line runs under the glyphs, and what shows between them carries about half the
  contrast of the line either side -- a redness of 10-17 against 21-39, on parenchyma that
  reads 3-6 -- so the vectorizer stopped at each edge of the word. The two dangling ends it
  left sat 28.6 px (200 µm) from their own continuation and 15.2 and 17.4 px from the
  `S1FL` line above them -- so `BRIDGE_PX` welded each of them sideways across the wedge,
  and the strip was walled into two faces of 4,148 and 1,070 px that no printed label
  named. The run is traced now, as one cubic between the two ends with its control points
  on their tangents; its chord sits 3.1° off the fragment it leaves and 3.3° off the one it
  joins, so the boundary is straight there and one cubic is the whole of it.

  **And the printed box seeded `S1J`.** A box seeds the face its own centre pixel falls in,
  and the centre of `S1DZ` is 8.7 px below the boundary, inside `S1J`'s face -- so the
  watershed split that face between the two names and gave `S1DZ` a blob around its own
  word: 0.0729 mm² with 47% of its border on ink. That is what `seed_overrides` is for, and
  this is its first row. `[1, 0.6528, 0.4097]` stands in for the right-hand box exactly as a
  leader tip does, on the wedge's midline directly above the word. The box does not move: it
  is where the word is printed, which is all it ever claimed to be.

  With the run and not the seed `S1DZ` comes out 0.3432 mm², the box still seeding `S1J`;
  with the seed and not the run, 0.5095, the medial 1,070 px still walled off by a bridge.
  Together **`S1DZ` on plate 18 goes 0.3663 to 0.5873 mm²** -- 0.0729 to 0.2939 on the
  right, against 0.2934 on the left, so the two hemispheres now measure within 0.0005 mm² of
  each other -- and every point of both polygons' borders is on printed ink, traced share
  0.470 to 1.000. `S1J` takes back the 0.0428 mm² the watershed had carved out of it (1.0760
  to 1.1188 on the right) and its own share goes 0.897 to 1.000. Plate 18 goes from 16
  unassigned faces to 14, and from 62 faces lettered by one abbreviation to 64.

  Nothing else on the plate moves by as much as a plate pixel. Three entries do move:
  `S1FL` (3.3779 → 3.3715 mm², by 0.88 plate px at its furthest), `fmi` (2.6881 → 2.6873,
  0.48) and `VP` (0.6460 → 0.6459, 0.16). The first two are the two bridges going away:
  each was a junction on a neighbour's border, and an arc no longer cut in two simplifies as
  one -- `S1FL`'s right polygon comes back in 34 points where it took 54. The third is the
  step-7 watershed re-solving. No other plate has an entry that changes by a point.

  Over the atlas `S1DZ` gains 0.221 mm² (7.570 to 7.791) and 0.0487 mm³ (2.4888 to 2.5375),
  and **comes out in six mesh components where it was in seven**: plate 18 was the gap
  between two right-hemisphere pieces, so the 0.1914 and 0.2828 mm³ fragments either side
  of it join into one of 0.5228. `S1J` gains 0.043 mm² and 0.0096 mm³ and keeps its four
  pieces. Five other structures move by under 0.003 mm³ apiece: `fmi` and `S1FL` from their
  own plate-18 polygons, and `S1DZO`, `ec` and `CPu` from the interpolation between plates
  17 and 19 reading the corrected plane. `boundary_edges_shared_exactly` stays 1.0,
  `regions_partition_the_volume` still asserts,
  the structure count stays 689, and `region_colors` comes back unchanged, all 689 slots:
  the wedge already touched `S1FL` and `S1J` on the left hemisphere, so no pair of names
  that touch on plate 18 is new and there is nothing for the solve to repaint.

  One consequence is meant to look like a regression and is not. Pointing at the printed
  `S1DZ` on the right of plate 18 now answers `S1J`, because that is where the atlas prints
  the word; `label_inside_its_own_region` goes 0.9750 to 0.9748 for the same reason. A word
  set outside the region it names is what `seed_overrides` exists to record.

  `tests/python/test_corrections.py` asserted `seed_overrides` was empty as its way of
  saying a dry run mutates nothing in memory; it now compares the block against the one it
  loaded, which says the same thing and survives a committed row. METHODS is brought up to
  what the scripts write, and most of the gap predates this change: entries carrying an area
  3,067 → 3,072 and the pairs the label pass located 3,204 → 3,209 (none of it this
  change), polygons 5,881 → 5,893 (none), points 166,844 → 166,973 (of which −15 is this
  change), entries carrying `w` 294 → 295 (none), and in the end-to-end paragraph labels
  answered with an outline 5,356 → 5,357 and with no extent to give 424 → 423 (both #88's,
  not this change) against labels answering to the name pointed at 6,309 → 6,308 and to
  another name 18 → 19 (both this change, and both of them the `S1DZ` box).

  Reported as #89, from the plate view.
- **`M1` gets its left hemisphere back on plate 27, from the mammillothalamic tract.** The
  atlas prints `M1` twice on every plate from 11 to 28, once per hemisphere. On plate 27 the
  left one was filed as `mt`: two characters against two, at the same size in the same face,
  which is as much as can be said for why. So the box at (0.3944, 0.2591) -- printed `M1`,
  between `M2` and `S1Tr` at the top of the section, where the drawing shows it plainly --
  belonged to a tract running through the diencephalon four millimetres below it. The seed
  went where the box was, and the dorsal cortical strip it seeded went with it.

  The wrong input was the box, so the box is what moved: one entry of `label_positions`,
  from `mt` to `M1` on plate 27. Nothing else was touched -- no tracing, no outline, no
  override -- and everything cut from that input was rebuilt.

  `M1` on plate 27 goes from one polygon of 0.4704 mm² to two of 0.8204, and `mt` from three
  of 0.5632 to two of 0.2131: the 0.3501 mm² strip moves whole, and no other one of the
  plate's 106 entries changes by a point. Over the atlas `M1` gains a label (35 → 36) and
  0.350 mm² (46.015 → 46.365), and its volume goes 16.4004 → 16.7476 mm³; `mt` loses the same
  label and area (1.74 → 1.39 mm²) and 0.1288 mm³. Both come out in **two** mesh components
  where each was in three -- one per hemisphere, which is what a structure printed on both
  should be, and the third piece was the mistake in each case. Six neighbours move by less
  than 0.13 mm³ apiece (`M2`, `cg`, `ec`, `MPtA`, `S1HL`, `S1Tr`), which is the interpolation
  between plates 26 and 28 reading the corrected plane. `boundary_edges_shared_exactly`
  stays 1.0.

  **The whole atlas repaints.** Four adjacency pairs change on plate 27, and
  `region_colors` is one solve over all 62 plates: re-run, it lands on a different valid
  eight-coloring, and 603 of the 689 regions take a different slot. Nothing about the
  coloring's guarantees moves -- eight colors, 631 patches, 28 refusals, no two regions that
  touch on a plate alike -- and the asks granted go 111 → 120. A slot has never meant
  anything beyond "not my neighbor", and it is not stable across a rebuild; that is what
  re-solving is.

  The rebuild also caught two things that had drifted before this change. The committed
  `region_extents` block predated `seed_overrides`, so its `derivation` now carries the
  sentence about a seed moved by hand, and its summary the `seeds_moved_by_hand` count.
  And METHODS's coloring paragraph was quoting an older solve: pairs that touch 4,434 →
  4,456, sharing a vertex 4,187 → 4,207, gap-only 247 → 249 over 526 → 532 plate
  occurrences, the pairs with an unprinted border 189 → 193 of which 87 → 90 are printed
  apart elsewhere, candidates 102 → 103, joins 74 → 75, asks 116 → 120, and the
  counterfactual 62 → 56. Only the last of each pair is this change; most of each gap was
  already there.
- **`E/OV` follows its own leader on the rest of the olfactory bulb, and `IEn` gets a
  hemisphere back.** The atlas cannot fit `E/OV` inside the olfactory ventricle on any of
  plates 1–5, so it prints the label outside the section with a line drawn back in; where
  that line was read, `E` is the slit the line ends in, and where it was not, the printed box
  seeded a scrap of the section's own border with the word sitting on it. Plate 5 was settled
  in #78 and plate 3 above; this is plates 2, 4 and 13.

  Two of the four fixes are a tip the march recorded in the wrong place, and one is a line it
  never proposed. On **plate 4** the left-hand line was found from `OV` and stopped 45.6 px
  from the word — barely past `MINTIP`, and in the 28,726 px face `EPl`'s own word seeds, so
  `E` drew a band down the medial edge of the bulb. Its black ink runs 209 px and ends in the
  1,085 px ventricle face that mirrors the one the right-hand line already reaches: `E` goes
  0.881 to 0.133 mm², a slit on each hemisphere, and `EPl` takes back the band it had been
  holding, 1.078 to 1.886. On **plate 13** both the left-hand `E/OV` line and `IEn`'s ended
  in the one face `DEn`'s own word seeds, and with three names in it `IEn` lost the left
  hemisphere outright. The reading is taken from the plate's own mirror: on the right the ink
  ends inside a 211 px sliver too small to seed and the recorded tip sits 6.5 px back from
  it, on the compartment side of that sliver's wall, which is the answer; 8 px back on the
  left is the same reading. `E` moves into the compartment its line points at (0.136 to
  0.165 mm²) and `IEn` is drawn on both hemispheres for the first time, 0.042 to 0.102.

  **Plate 2** is where the honest answer is a gap. Both of its lines are now read — the
  right-hand one had no piece survive the straightness test, the left-hand one stopped 24 px
  short out in the granule layer — but the ventricle on the left hemisphere is cut by the
  tracing into beads of 41 to 1,363 px, and the bead its line ends in is under `MIN_AREA_PX`.
  So `E` keeps one entry there rather than two, 0.135 to 0.029 mm². That is worse as
  coverage and better as a claim: what it gave up was the printed word and the border under
  it. **Plate 1**'s right hemisphere is left exactly as it was for the same reason carried one
  step further — its beads are 96 to 300 px, all under `MIN_FACE_PX`, so a correct tip snaps
  to the granule layer and `E` swells to 0.79 mm². Neither is a hole a connector would close:
  overlaid on the printed page the traced lines through both hairpins wander between the
  walls, cross the ependymal band and swap sides, so there is no missing run to add and the
  repair would mean replacing tracing rather than completing it. A 24 px connector on plate 2
  was written, ink-checked at a median 1 px against a traced control's 0 and a blank control's
  5, and reverted when it moved not one face.

  Two labels were added with them, and they are not bookkeeping: `OV` on plates 1 and 2, the
  right-hand half of `E/OV`, printed once per hemisphere and read on one side only. The
  leader march aims at the *whole* of a joined label, so with only `E` boxed the line arrives
  between the two names and reaches nothing — locating `OV` on plate 2 is what recovers that
  plate's left-hand line at all. 6,337 labels are located now, over the same 3,344
  structure-plate pairs, and 240 of them are set outside their region on a line.

- **Five more regions the app drew wrongly, and no two for the same reason.** All five were
  reported from the plate view, and each is fixed at its input rather than in the extents.

  `E/OV` on **plate 3** was wrong on both hemispheres, and differently on each. The atlas
  draws the olfactory ventricle as a slit inside the granule layer and prints `E/OV` beside
  the section with a line back to it. On the left the line was found and its recorded end
  stopped 24 px short — the slit is narrower than twice the skirt the tracing is subtracted
  with, so the march loses the line's last stretch along with the wall it crosses, which is
  plate 5's failure exactly. On the right no line was found at all: it runs the length of the
  bulb and every wall it crosses cuts it, so what reached the straightness test was a string
  of fragments, and the box seeded a sliver of the section's own edge where the word is
  printed. Both ends were read off the page by marching the leader's own black ink, and the
  same march reproduces the one tip a reader had already written into `TIP_READ` by hand to
  0.0001 of the frame. `E` goes 0.67 to 0.0669 mm² — the two ventricles, with their borders
  100% on drawn ink instead of 93.4%. The ground it gives up does not become unassigned: it
  goes to `aci`, which seeds the same face, and which grows 0.74 to 1.29 mm². `aci`'s own
  line stops short in the same way — 53 px on one side and 30 on the other — but reading its
  ink to the end does not put it in the commissure it names: on the left the end lands in the
  ependymal band round the ventricle and on the right in the granule layer it started in.
  Both circles are still unnamed. So `aci` is left as it is rather than moved somewhere the
  page does not support, and the two circles stay unassigned, which is the honest answer
  until someone can say what the line means there.

  `lo` on **plate 13** outlined the paper its own name is set on. The atlas prints `lo`
  clear of the section with a 15 px line back to the lateral olfactory tract, which is under
  `MINTIP` — the floor that stops a hyphen or a bracket being read as a leader, and the right
  reading for those. Left on its box the seed landed outside the drawn border, in the
  crescent between it and the published outline, so the region was a scrap of white paper
  wrapped round the words `lo` and `lEn`. Its end is read off the page and the entry is now
  the band inside the border its line points at.

  `S1DZ` on **plate 23** was cut short of the external capsule on one hemisphere. The atlas
  draws the dysgranular zone as a narrow strip between two dashed lines that both end on `ec`
  with a tick; the tracing stopped the lateral wall 35 px above it, and the bridge welded
  that dangling end sideways to the *medial* wall 17 px away, sealing the strip early and
  handing its ventral end to `S1BF`. The missing run is traced now: the printed dashes sit a
  median 0 px off it, against no ink at all within 12 px of a control chord beside it.
  `S1DZ` goes 0.478 to 0.501 mm² with its third polygon's support 0.975 to 0.992, and `S1BF`
  gives back the same ground. The other hemisphere was already right and did not move.

  `STLP` on **plate 23** had no entry because it had no label. It is printed once per
  hemisphere, it is in the published index for plates 23–24, and neither box had been read;
  cut from plate 24 and matched back they score 0.700 and 0.681 on ink at 0.25 and 0.24.
  `STLP` is 0.4931 mm², both polygons 100% on drawn ink.

  `InWh` on **plate 34** had taken the lateral third of `InG` on one hemisphere. The atlas
  draws the boundary between them as a dashed line and the tracing has it, but its lateral
  end stopped 21 px from the solid line it meets — one pixel past `BRIDGE_PX` — so nothing
  sealed and the watershed drew the split itself. Twenty-five pixels of connector close it.
  `InG` goes 0.715 to 0.821 mm² and `InWh` 0.955 to 0.847, and both supports rise. The
  boundary is untraced on the other hemisphere as well; that split is still the watershed's
  own and is left as it was rather than re-traced by hand.

  Two labels were added with them: `OV` on plate 3, the right-hand half of the label `E/OV`,
  matched from its own located copy at 0.997; and the two `STLP` boxes above. 6,335 labels
  are located now over 3,344 structure-plate pairs.

- **`SHy` is in the atlas, and was in neither of its indexes.** The septohypothalamic nucleus
  is printed on plates 22 to 25 — once per hemisphere on 22, 23 and 25, twice per hemisphere
  on 24 — and the published index carries no row for it at all: both the Index of structures
  and the Index of abbreviations run septofimbrial to septohippocampal to simple lobule with
  nothing in between. The glyph was read at 16× against the label face to rule out a Greek
  gamma, and neither raw index transcription holds a single non-ASCII abbreviation, so the
  omission is the paper's. Every audit this repository runs is answerable to the index, which
  is why nothing had caught it: the twenty-unlettered-structures pass walks the index, and
  `label_positions` holds only pairs the index lists.

  Following the index here would mean dropping a structure the atlas draws, names and letters
  ten times over, so `SHy` is carried instead — the one place the database holds a structure
  the published index does not list, recorded in `verification.known_source_discrepancies`
  with what the page says. Its labels were composed from located glyphs by
  `tools/find_unlettered.py` and every candidate read against the printed page; its extents
  follow like any other, at 0.39, 1.03, 0.36 and 1.76 mm², the last carrying `w` because on
  plate 25 the atlas prints the name and draws it no boundary. It takes ground from `AHA`
  (1.75 to 0.36 mm² on plate 25) and `MPO` (1.56 to 1.19) where those had been holding it.
  `index_entries_checked` stays 3,510: the index is what it is.

- **The color search restarts somewhere new, instead of a thousand times from the same
  place.** Only the tabu tenure was seeded, so every restart set out from the one DSATUR
  coloring; where that start sits in a bad basin they all stall in it together and the search
  reports a color count that is too high. Adding `SHy` did exactly that — 1,024 restarts and
  twenty million moves, two conflicts short of eight — and a ninth color is not a thing this
  app can render: `MCPAL` in `src/app.js` holds exactly eight, and a region in slot 8 comes
  out `undefined` with no test to catch it. It was never the atlas asking, either: an exact
  maximum-clique search over the 631 patches returns eight. Restarts now kick a share of the
  start's patches to random slots, cycling the strength, and the eighth color comes back.
  The kick has to be hard — a twentieth, a tenth, a seventh and a third each found nothing in
  twenty tries, and half to three quarters found it — which is why the strengths are cycled
  rather than picked. `SEEDS` is back to 256 and the first restart is still the plain DSATUR
  start. 689 regions in 8 colors, `colors_are_the_fewest` true, and every plate repaints, as
  it does whenever the coloring is re-solved.
- **Four regions the app drew wrongly, and the four different reasons.** Each was reported
  from the plate view, and no two share a cause.

  `S1DZ` on plate 19 was a scrap on the left hemisphere and a proper band on the right, with
  `S1J` bulging through the gap between. The tracing had missed a 30 px run of the dashed
  boundary, and the two dangling ends it left sat 30 px from their own continuation and under
  20 from the `S1FL` line beside them — so `BRIDGE_PX` welded each of them sideways across the
  band, walling the strip off from the face holding its label. The missing run is traced now,
  as a cubic; `S1DZ` goes 0.43 to 0.61 mm², which is its mirror.

  `ML` on plate 36 had no area at all. The atlas draws the mammillary body clear of the rest
  of the section there, and `brain_outline` keeps a component only if it is larger than
  `max(400 px, 2% of the largest)` — the island is 1,628 px against a 5,131 floor, so it was
  culled, and a face outside the outline can never be named. It is traced by the same steps
  and kept as a second polygon. Two components the rule drops carry a printed name over the
  62 plates; the other is `och` on plate 22, which the next entry takes.

  `OV` on plate 5 outlined the bulb's outer layer instead of the ventricle its line points
  at. `E/OV` is one label of two names and one line, and only one of the two boxes can be the
  one the march reached — the other kept the printed position, out beyond the section, and was
  snapped into whatever face was nearest. A line is recorded against every name in the label
  it was drawn from now, and the march aims at the label rather than at one word of it, which
  is what finds plate 5's right-hand line at all: it passes 1.4 px off the corner of `E` on
  its way to the gap between the two words. 215 lines answer for 233 boxes.

  That left the right-hand `OV` outlining the band around `aci` rather than the ventricle,
  because the line ends *inside* a ventricle 4 px wide and the march advances only on ink
  the tracing did not draw — so the last 19 px of the line was masked out with the wall it
  runs through, and the tip stopped 6.9 px short, on the near side of that wall. Marching
  the leader's own black ink would find it and move 47 of the 215 tips, four by over 35 px,
  which is 47 lines to read against the page first; this one was read, and sits in
  `TIP_READ` with what the page says.

  Layer `1` was missing from plate 17 and half-missing from plate 18 — not geometry but
  reading: none of plate 17's four printed `1`s had a box. A bare `1` cannot be found by
  matching the word, scoring 0.98 against the 1 inside `S1DZ`, `M1` and `Cg1` and against the
  coordinate ticks, so the match was anchored to the neighbourhood of a `2` or `3` already
  read — the digits are printed as a stack — and every candidate was put beside the printed
  page. Seven boxes added over the three plates, two candidates rejected there. Plate 17 gives
  layer 1 back 0.87 mm² that `Nv` had been holding for want of a label to take it.

- **The map coloring nearly shipped a ninth color the palette has not got.** The search gives
  `k` up after `SEEDS` restarts and tries `k+1`, and nothing downstream would have said so:
  slot 8 renders as `undefined`. The floor is unmoved — `1`, `2`, `3`, `AHA`, `ICj`, `Pir`,
  `Tu` and `VP` still pairwise touch, so eight is still the fewest — but locating layer 1 on
  plates 17 and 18 moves four edges of the quotient graph, and on that graph the eighth color
  is found on a seed past 128. `SEEDS` is 256.


- **The optic chiasm had no area on plate 22.** `och` is printed and outlined there, and the
  published index gives it as plates 21–25, but `region_extents` had it on 21, 23, 24 and 25
  only, so the app could show no area for it on the one plate in the middle. The cause was in
  `brain_outline`: the atlas draws the chiasm on plate 22 as a closed island standing clear of
  the section, and the outline derivation keeps a connected component only if it is bigger
  than `max(400 px, 2% of the largest)`. At 3,515 px the island is well over the 400 px floor
  and under the 2% one — 4,331 px — so it was dropped for being small beside a whole section
  rather than for being noise. `build_region_extents.py` fills the outline for the section
  interior, so a face outside it can never be named, and the structure came out with a hole in
  the middle of its run. The island's contour is now traced by the same steps
  `brain_outline.derivation` describes and stored as the plate's second polygon: re-deriving
  every other plate that way reproduces the committed vertices exactly, which is what says the
  convention is right.

  `och` on plate 22 is 0.98 mm² with its boundary 100% on ink the tracing drew — no inferred
  split anywhere on it. In three dimensions it goes from two disconnected pieces spanning
  21–25 with a gap, centred off the midline at ML −0.58 and +0.09 mm, to one piece over the
  whole run centred at ML −0.01, which is where a chiasm belongs. `ML` on plate 36, above,
  was the other of the two components the 2% rule drops that hold a printed label; with
  this one both are kept, and the rule now culls nothing the atlas has printed a name
  inside.
- A control group carrying `hidden` was drawn anyway. `.grp{display:flex}` is an author rule
  and the browser's own `[hidden]{display:none}` is not, so the author rule won and the
  panel's *Viewpoint and panes* heading stood over nothing whenever its controls were in the
  bar. `.grp[hidden]` says it now, the way `.vctl`, `.tg` and `.seg` already do.
- The panel's heading always read *Plate controls*, whichever view it was showing the
  controls for.
- The right-edge fade did not appear on a phone. Only the strip was watched for a resize,
  and on a phone the strip is a fixed 100% wide — the thing that changes is what is standing
  in it. Its groups are watched too now.
- **The source switch was being cut off in the 3-D view on a phone.** A group in the control
  strip was left free to shrink — flex's default, and `.vctl` carries `min-width:0` — so on a
  390 px screen the 3-D strip squeezed the switch from its natural 175 px down to 108 and
  `.seg`'s `overflow:hidden` ate **Myelin**. A clipped button is not a scrolled one: no
  gesture brings it back. Groups in the strip keep their own width now, and the overflow goes
  where it belongs, to the strip's own sideways scroll.
- The strip fades at its right edge while there is more of it to reach, and stops once it has
  been scrolled to the end. On a touch screen there is no scrollbar to see, so without it a
  control past the edge is a control nobody knows is there — which is how the switch went
  missing in the first place.

### Changed

- **A notice is laid over the plate instead of pushing it around.** The one line the app
  writes when something needs saying — this structure is not on this plate, that import was
  not JSON, the image has not arrived yet — sat under the picture in the column flow, so it
  took its height out of `#imgbox`, which is what `fit()` measures. Selecting a structure on
  another level therefore answered by shrinking the section you were reading and moving it up
  the screen, and dismissing the notice moved it back: on a phone, where the plate is 249 px
  tall, a two-line warning cost it a tenth of that and a jump each way. The notice is now a
  child of `.imgwrap`, like the scale bar and the **i**, so it floats at the top of the plate
  and takes height from nothing. It is laid on thinly enough to read the drawing through, it
  is outside `.pan` so zooming and panning leave it where it is, and its events stop at its
  own edge so the **Go to plate** button inside it is not a click on the section behind it.

  Because it is now covering something, it can be put away: an **×** at its end. Each notice
  carries a key saying what it is *about* rather than how it is worded, and the × holds down
  that key — so stepping through the plates with a structure that is on none of them keeps
  the notice down instead of putting it back a plate at a time, while anything else the app
  has to say is shown. Picking a structure lets it back up, on the grounds that asking about
  something is asking to be answered. Nothing about the line's content changed, and it keeps
  the live region that announces it.

- **The planned track is drawn on the comparison plate too.** `tgDraw()` put the track into
  the main pane only, so turning compare on gave you two plates and one track. The per-plate
  rendering is now `tgTrackSVG(o, ap0)`, keyed on the bregma of whichever plate is being
  drawn, and it fills both panes: the current plate, and whatever compare is showing beside
  it — the same section under another stain, or the one before or after. Each pane ghosts the
  track against its own plane rather than copying the first, so a track that never reaches
  plate 47 shows ghosted there while it is solid on 46, and `tgFootPlate()` takes the same
  `ap0` so the footprint sphere is cut by the right plane on each side.

- **A region keeps its color across the whole atlas.** Color regions was solved one plate at
  a time, and a plate cannot know what its neighbors did: a structure bordering three things
  on one level and five on the next took whatever slot was free on each, held its color
  across a step **48% of the time**, and the color a reader had just learned as `CPu` was
  somebody else's a plate later. Stepping through the levels repainted half the section.

  It is now solved **once, over all 62 plates together**, and the answer is stored --
  `region_colors` in the database, one palette slot per abbreviation, written by
  `tools/build_region_colors.py` and carried by the page. A region wears one color and wears
  it everywhere; **stepping now moves the boundaries and repaints nothing**. The invariant the
  view exists for is untouched: no two regions that touch -- sharing a point, or with a gap
  under 0.05 mm -- are ever alike, on any plate.

  Two things pay for it. The palette grows to **eight**, Okabe and Ito's six that read as a
  wash plus a violet and a brown, because eight regions of this atlas pairwise touch --
  cortical layers 1, 2 and 3 against `Pir`, `Tu`, `ICj`, `VP` and `AHA` -- so seven cannot
  hold across the atlas however they are arranged. Eight is found, so eight is exactly the
  fewest. A plate on its own needed four to six; now 57 of the 62 carry all eight, which is a
  slightly busier picture bought against the whole section repainting at every step. And the
  names the atlas draws no boundary between can no longer always share a color. `w` is read
  off each plate's own ink, and **87 of the 189 pairs that share an unprinted border somewhere
  are drawn apart by a printed line somewhere else**; one color cannot be both. The printed
  line wins every time -- erasing a boundary the atlas draws is the worse error -- so 102
  pairs are candidates to be joined, **74 joins hold and 28 are refused** because a printed
  boundary would have fallen inside the patch they made. The 688 regions become 631 patches,
  the largest seven names, and the refusals are listed by name in the block.

  The search moved out of the app with the answer. Coloring the plate no longer builds an
  adjacency graph in the browser -- **about two seconds over the 62 plates**, on a page that
  opens from a file -- and the toggle is now a table lookup. The derivation is peeling plus a
  seeded tabu search on what is left, so a re-run reproduces the block byte for byte and
  `--check` says whether the committed one is current; CI runs it. `tests/python` re-derives
  the adjacency from the committed extents and checks the invariant on all 62 plates, and the
  browser tests check it from the page's own geometry on seven.
- **Region outlines that do not cross themselves, at four times the resolution.** Two things
  were wrong with the extents, and the second only showed once the first was fixed.

  The first is a burr. The watershed settles a boundary to the pixel of the 8 Mpx page it is
  cut on, and at that scale it leaves pixel-wide slivers along the boundaries it settles: a
  tongue of one region running twenty pixels down the edge of another, a sliver of a third
  lying inside a fourth, a pixel two of them meet at diagonally. As area those are nothing —
  a third of a plate pixel, under the width of the line the atlas prints — but Douglas-Peucker
  keeps whatever lies far from the chord, and the tip of a twenty-pixel tongue is far from it
  however thin the tongue is. So each one came out as a **spike**: an edge running out along
  the boundary and back over itself, across the region's own outline. It is what a reader saw
  as a stray whisker off the top of `FrA` on plate 9, and it was not rare — **9% of polygons
  crossed themselves** (594 of 6,564, 1,293 crossings), and **2,722 vertices were repeats of
  the one before them**, zero-length edges every consumer had to know to skip.

  `regiongeom.deburr` takes them off before the boundary is traced. A pixel is thin when no
  2 × 2 block of its own label contains it — the one local test that passes a staircase, which
  every boundary here is, and fails a sliver — and thin pixels go to the nearest label that is
  not. It is a relabeling rather than a cut, so the map is still a partition of the same
  ground: the regions still tile the section, both owners of a boundary still trace the
  identical chain of corners, and `boundary_edges_shared_exactly` stays at **1.0**. A burr is
  given away rather than thrown away — what one region loses its neighbor gains — so nothing
  leaves the section and no entry loses its ground: the same 3,065 structure-plate entries,
  every one of them still with an area.

  The second is the tolerance. It was 2 plate px — 35 µm, the figure `brain_outline` uses —
  and at that setting the polygon visibly cuts the corners of the line it is tracing. It is
  now **0.5 px, 9 µm**. The floor is the page lattice the boundary is traced on: at 0.35 px
  the tolerance drops under the raster step and the polygon starts recording the staircase
  instead of the line, at seven times the points for nothing. At 0.5 px it does not.

  Together: **166,899 points over 5,882 polygons** where there were 77,453 over 5,630, a
  median traced share of **1.00** where it was 0.98, 81% of polygons at or above 0.90 where
  it was 78%, the worst plate's section-area residual **2.4%** where it was 3.0%, and **two
  polygons of 7,048 crossing themselves** where 594 of 6,564 did. Every area is redrawn
  against the pixels it was cut from rather than a 2 px smoothing of them: 2,868 mm² over all
  the entries becomes 2,871, the median entry moves 2.3%, and the ones that move most are the
  thin ones a coarse tolerance had folded — `IG` on plate 25, 0.022 mm² of indusium griseum,
  comes back at 0.035. `w` is carried by 294 entries rather than 312 (21 out, 3 in), because a
  polygon that tracks the ink to half a pixel has more of its border on the ink.
  `data/gerbil_atlas.json` grows 2.7 MB → 4.7 MB and `index.html` 5.5 → 7.4 MB; the meshes,
  the label volume, the GeoJSON and the structure table are rebuilt from the new extents.
- **The controls dock beside the view rather than over it.** They were a popover on a wide
  window and a sheet on a phone, both out of the flow so that opening them could not resize
  the picture. They are furniture now: a column to the right of the view where there is
  width for one, a row above it where there is not. That reverses the trade deliberately —
  the picture gets smaller when they are open instead of being partly hidden behind them,
  and nothing you are looking at is ever covered. At 1440 px the plate goes 985 px wide to
  665 while they are open, and back to exactly 985 when they close; every open and close
  runs the same re-fit `setMax()` does, because `fit()` is what keeps the SVG overlays on
  the image. The backdrop went with the sheet, and so did closing the panel whenever a
  click on the plate was armed — a docked panel covers nothing, so arming **Add** no longer
  costs you the panel you were working in.
- **Each view remembers its own staining.** The plate and the stack shared one source, on
  the grounds that a build where the two disagreed would be a puzzle. It is not a puzzle,
  it is the comparison: reading a Nissl stack against the labeled plate is what having both
  views is for. They keep their own now, and switching between them brings each one's back.
  The link carries both as `ps` and `ps3`, and `ps` alone still sets them together — which
  is exactly what every link written before this meant.

### Fixed
- The source switch had gone missing from the 3-D view. Moving the controls into a strip
  put it inside the plate's own group, so it showed only there; it belongs to both views
  and is offered by both again. The projection never had it and still does not: it plots
  where labels are printed, not pixels.
- **The picture first, and the controls on call.** Every control for the current view used to
  sit in one wrapping row above it. That works at 1440 px and does not work on a phone: at
  390 × 844 the row ran to six lines on the plate and twelve in the 3-D view, where it was
  taller than the canvas it drove, and the picture started 290 px down a 844 px screen. The
  row now holds only what steers the view — the tabs, the source or render switch, the pane
  controls — in a strip that scrolls sideways rather than wrapping. Everything else moved
  into one panel, presented as a sheet over the picture on a phone and a popover under its
  button on a wide window; inside it, **Advanced** folds away the settings that are made once
  rather than driven: contrast, the tone curve, the slab. Measured at 390 × 844: the control
  bar 290 px → 94, the top of the plate 290 → 157, the plate itself 352 × 225 → 390 × 249,
  and the 3-D canvas 250 → 400. Nothing was removed, and no control id changed, so every
  deep link written before this still opens the view it named.

  The panel is out of the flow in both presentations, which is the point: `#imgbox` is what
  `fit()` measures, so opening it cannot resize the plate under the pointer. That also fixes
  a long-standing twitch — revealing **Add** when Notes was ticked used to rewrap the toolbar
  and move the picture a frame later, which `tests/js/notes.spec.js` had to wait out.
- **The zoom buttons come off a phone.** The plate has had a real two-finger pinch since the
  pan and zoom were written; it anchors between the fingers rather than on the box center,
  and `zoomAt` clamps at 1, so pinching in lands on exactly the state **Fit** writes. Under
  900 px the − / 100% / + / Fit cluster is therefore hidden — hidden, not removed, because
  `applyView()` writes to all three of those elements on every pan. A wide window keeps them,
  because a mouse has no pinch. The gesture was never documented; it is now, in About and in
  the README.
- **What each view is showing moved onto the picture.** The line under each graphic cost that
  graphic its height on every view — in the 3-D stack it reached 1,059 characters, about
  eighteen lines on a phone, taller than the canvas it described. It is now behind an **i** in
  the corner the scale bar does not use. Only the commentary moved: the coordinate readout,
  the running measurement and every warning stay in flow, because a warning is the only place
  the app says a structure is not on this plate — and it carries the **Go to plate** button
  that fixes it — and because the measurement counts up as you move to the second point,
  which a panel you have to hold open cannot do.
- **The 3-D view no longer crops the brain because its box is tall.** The projection took a
  fixed vertical field and derived the horizontal one from the aspect, so a viewport taller
  than it was wide cut the ends off the stack rather than showing more of it. That is exactly
  the shape a pane takes once the view is split, and the shape the whole view takes on a
  phone. The binding axis is now the one held: at or above 1:1 nothing changes, and below it
  the vertical field opens by 1/aspect so the horizontal extent stays put. Found because the
  taller canvas this release gives the split view dropped the occipital crest off the end of
  it.

### Fixed
- Two 3-D specs read the canvas with `toDataURL()` immediately after `v3frame()`, which only
  schedules a render for the next animation frame — so they were comparing two empty 20 kB
  buffers and passing on the difference between them. They call `v3render()` now, the way
  `landmarks3d.spec.js` always did and the way their own comment says they meant to, and the
  blank-buffer guard went from 5 kB to 100 kB, which is the difference between an empty
  buffer and a rendered frame.

### Changed
- Below 560 px the cards take the phone's full width and the header buttons get compact
  padding, so the header stops wrapping to two lines and the plate gets the margins back.
  Nothing is hidden to achieve either.

### Added
- **The section as a map: every region colored, no two neighbors alike.** **Color regions**
  over the plate fills all of them at once, and gives no two regions that touch the same
  color — the atlas colored the way a map of countries is. What it shows is the thing the
  app could not show before: not the one structure you asked about but the whole partition,
  where each stops and the next starts and which of them are neighbors. On the *Nissl*, the
  *myelin* and the *MRI*, which print no lines at all, it is the only view that shows any of
  it. **Wash** sets how strongly the colors are laid on, both ride in the link (`&v=C`,
  `&cw=`), the second pane is colored on its own plate, and the PNG and the SVG carry the
  colors — the SVG as one named group, `region-colors`, one path per region with its name
  on it.

  Neighbors come off the extents rather than out of a picture: they tile the section, so two
  regions that share a boundary share its vertices exactly, and the vertex index answers who
  touches whom with no tolerance at all. A gap thinner than 0.05 mm counts as touching too —
  a lamina a pixel or two wide is not a boundary the eye can find at the zoom the plate opens
  at, and one color on both sides of it would read as one region; 91 pairs over the 62
  plates would have matched without that, `Py` between `Or` and `Rad` on plate 30 among them.
  The colors themselves come from a greedy pass in smallest-last order, which is why the
  palette cannot run out: five colors do 58 of the plates and six the other four, inside a
  palette of seven.

  **A color means nothing beyond "not my neighbor"** — not a system, not a division, not a
  value — and the line under the plate says so. What it does do is stay put: each region asks
  for one color of the seven, the same one on every plate it is drawn on, and takes it
  wherever a neighbor has not got there first, which is 48% of the time, so stepping through
  the levels is not a kaleidoscope and a plate is the same picture in every session and in
  both exports. Nothing is painted that the atlas does not draw. The fill carries no outline
  of its own — the only edge it makes is where one color stops and the next begins — the
  names the atlas draws no boundary between share a color rather than being split by one, so
  the mediodorsal thalamus is one patch and so are the cerebellar lobules inside one printed
  line, and the faces the atlas seals and names nothing inside are left unpainted, there
  being no region there to color.

- **Landmarks in the 3-D view.** Bregma, lambda, the interaural line and the occipital crest
  are drawn on the plate whose plane they fall in and as reference rules around the
  projections; in 3-D they can now be drawn as what they actually are. Each landmark's
  coronal plane is a rule up the midline, exact because the atlas's printed AP for it is
  exact. Bregma, lambda and the occipital crest carry a three-axis cross on the vault. The
  interaural line is the ear-bar axis itself, run laterally right through the head and out
  the other side the way the bars themselves go, with a ring where it passes each canal —
  this is the one view in the app where it is a line and not a point seen end-on. Only the
  rings are a measurement: they are where the fit puts the canals, which sit a fraction of
  a millimeter inside the bone, so the bar is carried clear of the widest of it rather than
  stopping there and reading as a chord inside the head. Nothing of it is depth-tested,
  deliberately: an ear bar is not hidden by the head it goes into. The names ride over the canvas as text so they stay upright and
  legible while the marks turn with the brain, and where two land on top of each other —
  which is what a rostral or caudal view does to all four — the nearer name is the one
  written. **Half** cuts the ear-bar axis at the midline with everything else. The heights
  come off the same approximate skull fit the shell does and the note under the view says
  so; the AP planes do not, and are drawn whether the fit is there or not. It belongs to a
  pane rather than to the view, like the rest of the 3-D toolbar, and rides in the link
  (`&lm=1`, `&lm2=1`). Unlike the projection's, it is not stood down by a working frame:
  there an AP rule is a line only because the view has flattened an axis away, while here
  it is the plane itself, turned by the same model matrix as the brain.

- **The MRI images ship with the atlas.** They were held back while it was unclear whether
  the volume could be redistributed; it comes from the same open-access supplement as the 186
  section pages, so it now travels with them and on the same terms — the work of
  Radtke-Schuller et al., reproduced under that publication's license and not relicensed here
  (`LICENSE-DATA.md`). **MRI** is therefore simply present now, rather than appearing only
  where someone had run `tools/build_mri.py` first. The copies here are 8-bit and resampled
  onto the plate frame for display; anything quantitative should go back to the source volume.

- **The atlas's own MRI, as a fourth plate source.** The atlas is "CT/MRI-aided", and the
  imaging half of that has never been in the app. Where `tools/build_mri.py` has been run,
  **MRI** now sits beside *Labeled / Nissl / Myelin*, and because the volume is already in
  the atlas's coordinates — one slice per plate — every overlay lands on it unchanged: the
  region outlines, the coordinate readout, the grid, the measure tool, a planned track, and
  the compare pane, which will now put the MRI beside the drawing at the same zoom and pan.
  The 3-D stack reads it too. It is the whole head rather than a cut section, and its voxels
  are 117 µm against the drawing's 18, so it is soft where the drawing is sharp; the About
  dialog says so. The volume is not distributed here, and the button is simply absent
  without it — the two committed pages are byte-identical either way.

- **Reporting a region drawn wrong, and asking for a feature.** Two more links in the footer
  beside *Report an issue*, which has always pointed at the tracker's front page — the right
  place for "the page will not load" and the wrong one for "this boundary is drawn in the wrong
  place". A drawing error means nothing without the region and the plate it is about, and
  **Report a drawing error** attaches both: the structure and its abbreviation, the plate and its
  bregma, which of the three plates is on screen, what the plate already says about that outline
  — its area here, and how much of its boundary the atlas actually prints — and a link
  back to the exact view. So a report arrives with the thing it is about already reconstructed,
  rather than as a name someone has to go and find. It says what it cannot say, too: that no
  region is selected, that the one selected is not drawn on this plate, or that it is a name the
  atlas draws no boundary around at all. **Request a feature** is the same dialog carrying the
  build and the view and nothing else, because a feature request is not about a region.

  What will be attached is shown above the box you write in rather than below it, because that
  is the part being agreed to, and the rows are built once and used twice — rendered there,
  written into the issue — so what the reader was shown is what is sent and cannot drift
  from it. Nothing is sent from the page itself: the button opens GitHub's own compose form with
  the text filled in, and the report is submitted there, by the reader, or not at all. **Copy the
  report** puts the same text on the clipboard for anyone who would rather not put it on a public
  tracker. And a page opened from a file sends the hosted link rather than its own
  `file:///C:/Users/…` path, which says more about the reader than a bug report has any
  business carrying.
- **The 3-D stack as a NIfTI.** **NIfTI** in the 3-D controls writes the whole 62-plate stack
  out as a gzipped NIfTI-1 volume — the reconstruction itself rather than a picture of it, so
  it opens in ITK-SNAP, FSLeyes, Slicer or nibabel and can be resliced, measured or registered
  against something else. The header is the 348 bytes of struct `tools/volume.py` already
  writes for the label volume, and the file is laid out the same way: voxels x fastest in
  (ML, AP, DV) order so it reads as RAS, with an sform putting each voxel center at its atlas
  millimeters — 32.4 µm across a plate, 350 µm through the stack, that anisotropy written into
  the file rather than resampled away. The labeled drawing writes two volumes, the ink and
  then the drawn contour, because on it the red contour is a picture in its own right; a Nissl
  or myelin stack writes one, because a photograph has no contour channel at all. Nothing the
  toolbar sets goes in — not the slab, not the midline cut, not the tissue curve: those say
  what is drawn, and this is what they are drawn from. The millimeters are the atlas's own,
  from bregma as the plates print it, the frame the STL export writes in too.

  Read from the plates again rather than kept from the build: the stack is 24 MB and the view
  hands its only copy to the GPU, so a second copy held in the page for every visit, against an
  export most of them never run, is the wrong side of that trade. It costs the few seconds the
  view itself cost and the note under the view says so while it runs. Written uncompressed as
  `.nii` where the browser has no `CompressionStream`, rather than not written at all.
- **Two 3-D views at once.** **Split** puts a second pane beside the first, and everything the
  3-D toolbar sets belongs to a pane rather than to the view: mode, density, the tissue curve,
  the slab, the midline cut, the projection, the skull, the meshes and the camera. **A** and
  **B** choose which pane the toolbar is on, and clicking into a pane makes it that one. So the
  contours can stand beside the volume they came from, a whole brain beside a slab of it, a
  structure's mesh beside the sections it was interpolated from — the pair of pictures the
  printed atlas cannot give you at all, and the reason for splitting rather than switching.
  **Lock** turns, zooms and pans both panes together, holding whatever angle apart they were
  set to, so a lateral and a dorsal view of one brain move as one; untick it and they turn
  separately. Every camera move goes through the one rule — a drag, the wheel, a pinch, the
  zoom keys and a named viewpoint all mean the same thing — except **Reset view**, which is
  "back to the default", and the default is one camera: a locked pair resets onto it together,
  which is how a pair turned apart is brought back onto the same angle.

  One canvas, one WebGL context, one 24 MB volume texture, one label cloud and one mesh cache,
  with a pane drawn as a `viewport` and `scissor` over it — so the second view costs pixels and
  nothing else: nothing is downloaded, decoded or uploaded twice. Side by side while the view is
  wider than it is tall and stacked while it is not, which is what a phone held upright gets.
  The divider, the pane letters and the frame on the pane being set are elements laid over the
  canvas rather than lines drawn into it, so they take the sheet's colors and stay a hairline
  at any pixel ratio — and they are put right on their own, so a rebuild after a source change
  cannot leave them on the pane they were on before. A deep link carries the second pane under
  the same keys with a `2` on the end (`r2`, `tf2`, `sl2`, `hf2`, `or2`, `vp2`, `sk2`, `mh2`)
  plus `sp` for which pane the toolbar was on and `lk=0` for an unlocked pair, and writes none
  of them while there is one pane — so every link ever written still reads as exactly the view
  it was written from.
- **Contrast controls for the 3-D render.** **Floor**, **Ceiling** and **Gamma** join Density
  in the 3-D toolbar and window the tissue channel before Density decides how opaque what
  survives is drawn: tissue at or below the floor counts for nothing, tissue at or above the
  ceiling counts for all, what falls between is stretched across the full range, and gamma
  bends that stretch — under 1 lifting faint tissue, over 1 keeping only the dense. Density
  alone could only turn the whole render up, fog included, which is what a Nissl or myelin
  stack of 62 pale sections mostly is; a floor around 40 % at γ 1.8 turns that fog into a
  volume with the folia and the cortical band visible in it. The same curve serves the slice
  stack and the ray-march, so a section reads the same either way, and on the labeled drawing
  a high floor takes the gray wash away and leaves the atlas's own contours standing alone.
  The two ends hold each other in order the way the slab's do, and meeting is allowed —
  a window with no width is a hard threshold. **Reset contrast** appears once there is
  something to undo. At 0, 100 and 1 the curve is the identity and the shader skips the `pow`,
  so an untouched view costs nothing and draws exactly what it always did. Carried in a deep
  link as `&tf=<density>,<floor>,<ceiling>,<gamma>` in hundredths and written only off the
  defaults, so no link written before this changes meaning; density now rides in a link too.
  The note under the view quotes the window whenever one is set — a windowed render is a
  picture of the tissue after something was done to it, and the reader of somebody else's
  link has no other way of knowing. See [METHODS](METHODS.md#the-tissue-curve).
- **Maximize.** A corners button beside Copy link, and <kbd>F</kbd>, give the whole window to
  whichever view is open — the plate, the projection or the 3-D stack. The search column, the
  header, the footer and the card's own frame step out; what drives the view stays, because it
  is still being driven. The browser is asked for its own chrome at the same time, so a rig
  screen or a projector shows nothing but the section. That ask can be refused — an iframe
  without the permission, a policy — and the page-level half is worth having alone, so a
  refusal is not an error: the layout goes either way, and leaving fullscreen by any route the
  page did not take puts the layout back with it. On a 1440 × 900 window the plate goes from
  909 × 581 to 1094 × 699, and the projection from 1013 × 623 to 1440 × 741. <kbd>Esc</kbd>
  comes back, and so does reaching for the search box with <kbd>/</kbd>. Under 600 px of window
  height there is no room to win — the toolbar alone would take most of it — so short windows
  keep their scroll and take only the width the sidebar and the margins were using. Not carried
  in a deep link: it is how you are looking, not what you are looking at.
- **The projection and the 3-D view can be drawn in your working frame.** Set a pitch, roll
  or yaw and an **In frame** checkbox appears in the toolbar of each; tick it and the label
  cloud and the section stack are turned into your frame, so up on the screen is your
  frame's DV and the axes are the ones the manipulator drives. One setting serves both —
  they are two pictures of one brain. Off by default, and carried in a deep link as `fv=1`
  only beside a rotation, so no link written before this changes meaning. What is applied is
  the rotation and nothing else: `toFrame` is `R(p−C)+A`, which is `Rp + (A−RC)`, so moving
  zero stays a relabeling of the axes and cannot slide the cloud off the plot. The
  projection widens its axes in whole millimeters per end to hold what the rotation pushed
  past the atlas's extents, and the plate guide becomes the line where that section's plane
  cuts the middle of the brain — still clickable, read back through the rotation at the
  depth it is drawn at. The skull silhouette and the landmark rules are flattened at the
  atlas's own angle and cannot be re-flattened at another, so their checkboxes go dead while
  a turned view is on. A turned view is not a resectioning: the same 62 coronal sections,
  stood up at an angle. See [METHODS](METHODS.md#views-in-the-working-frame).
- **Compare mode hovers both panes.** Hovering a structure on either plate now outlines it
  on both, by abbreviation, where the other plate has that structure too — not just the
  selection, which already carried across.
- **Gross divisions.** The atlas names 723 structures and no containers for them; twenty
  are added here — cerebral cortex and its four lobes, hippocampal formation, olfactory
  areas, olfactory bulb, amygdala, striatum and pallidum, septum and basal forebrain,
  thalamus, hypothalamus, midbrain, pons, medulla, brainstem, cerebellum, fiber tracts and
  the ventricular system. A division behaves like a structure everywhere in the app: it is
  outlined on the plate in its own color, listed on every plate it is on with thumbnails,
  plotted in the projection, drawn in 3-D as its members' meshes and downloadable as one
  STL, carried by a deep link, and written into the PNG and the SVG. **List them** narrows
  the structure list to a division's members, so the CSV and label exports answer for it
  too; a structure's own card says which divisions it is in.
- A division carries no geometry. Its outline is its members' outlines with the boundaries
  they share dropped — exact, because the region extents tile the section and every shared
  boundary is stored twice — its area the sum of theirs, its coordinate the median of their
  printed labels. See [METHODS](METHODS.md#gross-divisions).
- `tools/build_groups.py` writes the `groups` block from declarative rules; `--report`
  prints every division and its members, `--check` runs in CI.
- `data/gerbil_atlas_groups.csv`: one row per division with every member spelled out, so the
  taxonomy — the one block of this database that is a judgement rather than a transcription
  — can be read and argued with without opening the JSON.
- The footer says when the page was last updated, beside the build it was made from. The
  stamp is UTC and reads off one instant — the commit's own, or the moment of the build
  when it was built from a dirty tree — so its date and its time cannot disagree.
- **Notes go into the PNG and the SVG.** A sheet saved with notes showing now carries their
  markers — a `notes` group in the SVG, each with the note's text as its title — and the
  caption counts them. The exports draw whatever the plate is showing, and the notes were
  the one thing they left out.

### Changed
- **The 3-D view opens ray-marched.** **Volume** is now the mode a pane opens in and
  **Contours** is one button along. The stack of textured plates is the honest picture of
  what the reconstruction is — 62 sections and the gaps between them — but at the default
  oblique angle it is 62 cards seen nearly edge-on, which is not what somebody who has just
  clicked **3D** is looking for; the march reads the same field and shows the brain as a solid. The
  note under the view still says what the stack is either way. A link that names no mode now
  reads as the volume: every link ever written without an `&r=` opens ray-marched, and
  `&r=contour` is what a link now carries to ask for the stack.

- **A note on the plate is a marker, not its own text across the drawing.** Every note used
  to print its line of text beside its ring, so a plate with a handful of them on it was
  read through its own annotations. A note now draws as a small bubble with its tail on the
  point it marks, and what it says is in its tooltip, in the **Notes** pane's list, and in
  the form the marker raises when it is clicked — where it can be read, rewritten or
  deleted. The marker's hit target is larger than the bubble, so it can be aimed at with a
  finger as well as a pointer.
- **A fissure is not a region, and neither is `cbw`.** Twenty of the 723 names the atlas
  prints name no ground of their own: the sixteen fissures, sulci and the rhinal incisure,
  which are the clefts *between* regions and are drawn as the lines between them; `cbw`,
  the white matter core of whichever lobule it runs through; and the three vessels `acer`,
  `mcer` and `BV`. Seeding them against their neighbors handed each the ground on both
  sides of a line that is a boundary rather than a region — `cbw` alone held 170 mm² of
  cerebellum, which left `Crus2` a wedge of its own lobule and, on plate 54, `PM` nothing
  but its label box. A new `features` block names the twenty and says what each is;
  `build_region_extents.py` still seeds them, because a seed in the depth of the white
  matter is what stops the lobules racing each other down it, and then empties them, giving
  the 184 mm² back to whichever region is nearest measured around the atlas's own lines.
  The lobules gain between 1.5× and 2.9× — `Crus1` 45.9 → 72.9 mm², `Crus2` 16.7 → 29.4,
  `PM` 8.4 → 19.7, `Sim` 4.1 → 21.7 — and each is now the whole territory its fissures
  bound, white matter included. No region loses ground; outside the cerebellum nothing moves
  by more than 0.25 mm². `hif` and `dcw` are deliberately not in the list: the hippocampal
  fissure is a space the atlas draws a boundary round, and the deep cerebral white matter is
  a territory of its own rather than a name printed inside another structure.

  The twenty stay searchable, listed, filtered by system, located on every plate that prints
  them, and plotted in the projection and the label cloud. What they lose is geometry:
  no entry in `region_extents`, no area, no volume, no mesh (685 structures carry one, down
  from 698), and no outline on the plate. Hover or select one and every place the plate
  prints its name is marked, with the tip saying which kind of thing it is — point at the
  word `cbw` and it answers `cbw`, move a few pixels off and it answers the lobule whose
  white matter that is. `region_extents` goes from 3,134 entries to 3,055, and the share of
  polygons whose boundary is under half drawn falls from 6% to 3%: a lobule cut back to a
  wedge was mostly invented boundary, and it is now mostly the fissure line the atlas draws.
  `w` entries fall from 372 to 309 for the same reason. One place it over-reaches — `IntDL`
  on plate 47, which the atlas draws as an open crescent, takes 3.7 mm² of the medullary
  body where the hump itself is 0.6; it carries `w`, so no outline is drawn, but its mesh is
  wide at that plane. See [METHODS](METHODS.md#region-extents).
- The working frame no longer persists across visits by default: a new visit starts back
  at the atlas. A **Remember across visits** checkbox in the Frame dialog opts back in;
  that preference is what actually persists, and it is off until set.
- **The hemisphere the atlas letters once is now named on both sides.** Most abbreviations
  are printed twice, one per hemisphere, but not all: `S1J` on plate 19, `MPtA` on 28,
  `LPtA` on 29 are set once, and the sealed face on the other side answered to nothing.
  `build_region_extents.py` now mirrors every seed about ML 0 and keeps the mirror where it
  lands in a face the drawing seals and no printed abbreviation names, and where over half
  of that face reflects back into the faces the mirrors came from. 122 seeds are added; what the page prints still wins in every face it prints in,
  so nothing is renamed. `region_extents` gains 3 entries and 68 polygons, and the share of
  a section that has a name rises from 93.6% to 94.3%; `df` gets its first extent, so 698
  structures now carry a mesh.
- **No outline is drawn where the atlas draws no boundary.** The drawing sometimes seals
  several names in one bound and prints nothing between them — the cerebellar lobules
  against each other, the mediodorsal thalamus, the lateral hypothalamic zones —
  and the extraction's split of those is an invention end to end. Entries like that now
  carry `w` in `region_extents` (309 of 3,055), and the app draws no outline for them at
  all: hovering or selecting one highlights every place the plate prints its name, and says
  why. The geometry is still stored and still partitions the section, so tracks, volumes,
  meshes and the CSVs are unchanged. A face that merely merged through a gap in the tracing
  is not affected — the test is how much of the wall the watershed put *inside* a face lands
  on ink, not how much of the whole outline does, so `CPu` and `Po` keep theirs.
  `no_drawn_outline` carries the same flag into the per-plate GeoJSON.

### Removed
- **The NIfTI and STL download buttons, for now.** Both are out of the 3-D toolbar: **NIfTI**,
  which wrote the 62-plate stack out as a gzipped NIfTI-1 volume, and **STL**, which wrote the
  selected structure's mesh. Nothing about either file changes — the writers are unchanged and
  still reachable from the page's `__gae` handle, the NIfTI header is still held to its
  geometry by its test, and `tools/build_volumes.py --stl` still writes the meshes offline.
  What is gone is the two controls.

### Fixed
- **The line under the plate lost the "Go to plate" button it had just been given.** Two of
  the notes it carries are appended to whatever the selection wrote there, and appending with
  `innerHTML +=` re-parses the line: the button offered when the selected structure is not on
  this plate came back as fresh markup with no click on it. They are appended as nodes now.
  Switching the plate between *Labeled*, *Nissl*, *Myelin* and *MRI* also rewrote that line
  without those notes, so a dashed track lost its explanation on a source switch; it now
  rewrites the whole line rather than the selection's half of it.
- **The lean page never refreshed its offline copy, and a rebuilt data file never reached a
  returning visitor.** The service worker took its copy for the cache after handing the
  response back, when the browser already held the body, so the copy threw and the shell in
  the cache stayed the one cached at install. And the cache was named `gae-v1` for good:
  `data/` is served cache-first, so a visitor who had opened the meshes once kept that
  build's meshes for ever. The copy is now taken first, and the build registers the worker
  as `sw.js?v=<commit>`, so each build has a cache of its own and activating it drops the
  last one. The browser test checks both.
- **One printed word was two labels, eight times.** `find_compounds.py` gave every member of
  a compound token the token's box — including the member the reader had already located
  from the same ink, which then carried its own box and the token's: `S1J` on plate 20 and
  `RSGb` on 36, both hemispheres, `InG` on 41, `4Cb` on 49 and `11N` on 62. `GrA` on plate 8
  had the same from the label passes, a loose box beside a tight one. The eight second boxes
  are gone (6,323 labels become 6,315), the script leaves a member's own box alone, and the
  extents were rebuilt from the result: no region moved by any amount, only the label counts
  the six entries carry.
- **The 3-D contour stack was drawn near plate first.** The test for which end of the stack
  the camera was on had its branches crossed, so the slices went down front to back and the
  far plates were painted over the near ones — inside out, and visibly so at high density.
  And each slice sampled the volume at `k/61` rather than the center of layer `k`, which
  mid-stack blends a quarter of the neighboring plate into the section shown; the ray-march
  did the same. Both read at layer centers now.
- Smaller things in the app, each found on review: typing `P5` or `P7` — both are structures
  — jumped to plate 5 or 7; a tap on the plate or in the 3-D view after a pinch was
  swallowed, because the flag a drag leaves for the click that follows it was never cleared
  when no click followed; a double-click to zoom the Compare pane stepped the viewer two
  plates first; the arrow, zoom, `F` and Esc keys acted on the plate behind an open dialog,
  so Esc from About dropped the selection; the projection's AP ticks were ruled from a fixed
  8 to −12 rather than from the axis, and lost a gridline once an origin moved it; the bone
  opacity slider did not ride into the link; a source switched during the first 3-D build
  was never read, and every hashchange rebuilt the stack whether the source had changed or
  not; the SVG export circled the word rather than the end of its line for the labels the
  atlas sets outside their region; a note whose text held `~` broke the link that carried
  it; a track to a division was captioned by its key (`@hipp`) rather than its label; the
  measure tool could read 170° from vertical when the two points were clicked the other way
  round; an emptied field in the coordinate lookup searched at 0; the plan pane went blank
  for a structure with no located label instead of saying so; a report too long for a URL
  opened an error page rather than GitHub's form; the mesh note counted a division's
  members rather than the meshes they resolve to; Coords off left a crosshair in the
  Compare pane; arming a note was not cleared by Measure or Pick; the tilt boxes accepted
  100 while planning at 89; notes arriving by link did not reach the Notes list; and a link
  copied from the projection or 3-D tab dropped the plate's zoom.
- In the pipeline: `build_volumes.py` laid the plates 0.35 mm apart whatever `--plates` or
  `--res` said, so `--plates 5,30,45` or `--res 0.1` wrote meshes and a NIfTI with the wrong
  AP; it now refuses plates that are not consecutive and a voxel that does not divide the
  step. Its verification figures are written as numbers (`checks`) beside the prose that had
  been their only copy, and two of its notes described an opening it does not run and a
  decimation it does not do. The pons note and the README put the pons–medulla boundary at
  bregma −9.35; plate 49 is −9.00. The GeoJSON closed every ring twice. `export_tables.py
  --check` skipped `version.note`, and `--refresh-db` now recomputes the two label totals in
  `verification` as well. `check_indexes.py` crashed on an abbreviation only one index
  carried instead of reporting it, and `find_unlettered.py` ignored `$GERBIL_ATLAS_PDF`.
- The figures the README, METHODS and the app quote had fallen behind the data by a few
  passes — 6,266 labels for what is now 6,315, 215 leaders for 212, 3,298 located entries
  for 3,338, "20 of the 723 structures have no located label" for 7, 3,055 extents for 3,065
  — and are what the data says again, `verification.note` in the JSON included.
- **`PtP` was joined to `S1` on plate 30's left hemisphere.** The atlas prints `PtP` once per
  hemisphere, and the label pass had located only the right one — the left instance never made
  it into `label_positions`, so the extraction had nothing to seed that side's face with and
  `S1` claimed the whole thing, ground and all. Found by cutting the right-hemisphere label as
  a template and cross-correlating it against the same plate's page image (0.927, well over the
  0.80 the finder in `tools/find_missing_labels.py` requires, and read against the printed page
  before it was kept): the mirrored word is there, its region centered at ML -4.59 mm against
  the located side's +4.24, not an exact mirror. `find_missing_labels.py` itself did not
  catch this — its `want`
  list is abbreviations with *no* location on a plate, not one missing a second instance — so
  the box was added by hand and the region extraction rerun. `PtP` is now 1.50 mm² over both
  hemispheres (was 0.79, one side only) with a real drawn boundary on each, and `S1` gives back
  the 0.71 mm² it had no ink of its own claiming.
- **A note could not be saved, so there were never any notes to show.** The plate wrapper
  takes pointer capture on `pointerdown`, so that a drag which leaves the box still pans
  rather than stopping at its edge. Capture retargets the click that follows it to the
  wrapper, and the note form sits inside that wrapper: a press on **Save**, **Delete** or
  **Cancel** never reached the button it landed on. The click arrived at the plate instead
  and did what a click on the plate does — selected whatever region the form was covering —
  while the note stayed unwritten, which is why the **Notes** pane was empty however many
  had been typed. Only Enter in the text field ever committed one. The form's own pointer
  events now stop at the form, so its buttons get the clicks meant for them, and the plate's
  tooltip comes down when the pointer moves onto it rather than hanging there.

  The other half of it was geometry. The form was placed once, against the box as measured
  at that instant — but arming **Add** rewraps the toolbar, and `fit()` resizes the box a
  frame later. The box clips what overhangs it, so a note put near the right-hand edge
  opened a form whose **Cancel** was outside the box and could not be clicked at all.
  Placement is now `anPos()`, which measures the box and the form afresh each time and runs
  again on every pan, zoom and refit, so the form follows its point instead of being left
  behind by it.
- **`S1DZ` had lost its strip on plate 23, and `S1BF` was standing in it.** The atlas draws
  the dysgranular zone as a narrow band between two dashed lines running from the pia to the
  white matter, `S1BF` one side of it and `S1FL` the other. On the left hemisphere both lines
  are traced through and the band is a region 96% of whose border is on drawn ink. On the
  right it was a fragment of 0.13 mm² at 48%, and `S1BF`'s outline ran straight across where
  the band belongs — 4.07 mm² against the left side's 3.83. Two holes in the same traced line
  in `svg/GerbilAtlas_Plate_23.svg`, and only the first is the obvious kind: 45 page units
  between two subpaths, against the 20 `build_region_extents.py` bridges across, so the face
  never closed. Closing it stopped `S1BF` over-claiming and left the band belonging to nobody.
  The second is a gap the bridging step does not fail to close but closes to the wrong line:
  the dashed boundary's upper run ends 25.2 units from its own continuation and 18.0 from an
  unrelated dash beside it, so a rule that joins a dangling end to the nearest point on any
  other path welds the boundary sideways, and that weld was the wall cutting the band off from
  the small face holding the `S1DZ` label — which is why the label seeded a fragment while the
  band stayed unassigned. A wider tolerance makes that worse rather than better, the wrong
  line being nearer at every tolerance; telling the two apart wants direction, which
  nearest-point bridging has not got. Both holes are now traced, as cubics, because the
  flattener in `build_region_extents.py` reads `M`, `C` and `Z` and drops anything else
  without saying so. `S1DZ` is 0.486 mm² with its two hemispheres at 0.86 of each other
  rather than 0.16, its right-hand border 97% drawn rather than 48%, and `S1BF` gives back
  5.9%. Nothing else on the plate moves by more than 1%.
- `build_volumes.py --nifti` crashed on the pinned numpy rather than writing the label
  volume: `volume.py` selected the sentinel 65000 against an `int16` label array, and numpy
  2 refuses a Python int the array's dtype cannot hold instead of widening the result. The
  cast now happens before the selection, so `data/gerbil_atlas_labels.nii.gz` and its lookup
  table can be regenerated again.

## [0.9.0] — 2026-09-02

### Added
- LICENSE (MIT, code), LICENSE-DATA.md (CC BY 4.0, derived data; the plate images under
  the atlas's own license), CITATION.cff, and this changelog.
- The app is now built: `src/app.html`, `src/app.css` and `src/app.js` are the source,
  `tools/build_app.py` writes `gerbil_atlas_explorer.html` and a lean `index.html`, and
  stamps the commit and date into both. `--check` says whether a committed page is a fresh
  build; `--dev` writes a page that links the source files for editing without rebuilds.
- `index.html`: the same app at 5 MB, loading each plate as it is shown, with a service
  worker and a web manifest so it keeps working offline after a visit and can be installed.
- `data/plates/`: the 186 plate images as files; `data/vec.json` and `data/skull.json`:
  the traced outlines with their registration, and the skull, as committed assets.
- `tools/atlaslib.py`: the pipeline's shared paths, frame formulae, page-to-plate
  transform, outline readers, `--plates` grammar and the renderer that writes the
  database byte for byte as it is kept.
- `tools/export_tables.py`: the CSVs that used to be kept by hand, a per-label coordinate
  table (6,266 rows), a per-structure table with areas, volumes and mesh centers, and
  GeoJSON extents per plate; `--refresh-db` recomputes the per-plate counts the database
  carries and the `plate_registration` block; `--check` for CI.
- Tests: `tests/python` (the data's invariants, the shared library, the committed pages
  and tables against fresh renders) and `tests/js` (the built pages in a browser: search,
  deep links, sources, the projection and 3-D views, the frame transform's inverse, the
  deep link round trip, every structure's plan bounded). `.github/workflows/ci.yml` runs
  them on every push; `pages.yml` builds the site for GitHub Pages and attaches the bundle
  to a release on a version tag.
- Track planner: the structures along the track with the depth each spans from the
  surface, a probe length that reads the whole shank and names what the tip ends in, and
  a footprint sphere that lists the share of its volume in each structure — drawn on the
  plate, the projections and in 3-D, carried in the link, the notes and a new JSON export
  of the plan.
- Compare: a second plate beside the first under the same zoom, pan and crosshair.
- Notes: your own markers on the plates with a line of text, kept in the browser, listed
  in their own pane in the working frame, drawn on every view, exported and imported as
  JSON, carried in a link while there are few.
- Meshes in the 3-D view, fetched on demand from `data/gerbil_atlas_volumes.json`, with
  the brain surface as a shell and an STL download of the selected structure.
- `data/gerbil_atlas_labels.nii.gz`: the label volume as a NIfTI file at 50 µm with a
  lookup table, written by `build_volumes.py --nifti`.
- A strip of thumbnails showing the selected structure on each of its plates.
- Search: 26 more aliases across nomenclatures (70 in all), the alias a result came in by
  shown beside it, close matches offered when nothing matches exactly, recent structures.
- Exports: a per-label CSV from the app, one named group per region in the SVG export.
- Accessibility: tab roles and selected state on every segmented control, live regions
  for the readouts, focus rings, keyboard access to results, chips and thumbnails,
  `Home`/`End` and `?` shortcuts, hints in place of modal alerts, a `<noscript>` line.
- The neighboring plates are decoded before the arrow key asks for them.

### Changed
- `region_extents.validation` and the volumes' `validation` compute their numbers rather
  than carrying literals; the volumes' `note` states the mesh encoding is little-endian.
- The tiling check's worst-plate area residual is 2.1%, not 4.5%: the earlier figure
  omitted the closing edge of the outline rings, which `brain_outline` stores unclosed.
- `data/gerbil_atlas_volumes.json` regenerated with the versions `tools/requirements.txt`
  now pins: identical vertices, a different triangle order for 182 structures.
- `requirements.txt` pins the versions that reproduce the committed extents byte for byte.
- `--plates` reads `30`, `28-33` and `5,30,45` alike in every script.

### Fixed
- 3-D meshes: a structure printed inside somebody else's boundary -- A1 and AAF share one
  region with Au1, RSG with RSD -- was looked up by its own name, found nothing and drew
  nothing, though the plate outlines the shared region happily. It now resolves through
  the label block the way `regBuild()` does, and the note names the region it landed on.
  Where the atlas draws a structure no region anywhere (26 of the 723) the note says so
  rather than leaving an empty view and asking for a selection already made.
- The 3-D view's Surface toggle, STL button and mesh Load-file fallback were offered
  before the meshes were switched on: `.tgw` sets `display`, which beat `[hidden]`.
- Tapping a region on a phone flashed the whole plate blue: the plate carries the click
  handler, so Chrome painted its default translucent-blue tap highlight over the entire
  section, and the new thumbnail strip held the tap open long enough to see it by decoding
  every plate the structure is printed on. The surfaces that draw their own feedback now
  suppress the platform highlight, and the strip draws a thumbnail only once it is on
  screen — a tap costs no image decodes and is back to its pre-update duration.
- The app's structure table (`window.__ATLAS__`) and `data/gerbil_atlas_structures.csv`
  carried the pre-correction plate ranges for AngT, RLi, Su3C and ZIC; both are now built
  from the database.
- `plates[].n_labels_located`, `plates[].ocr_confirmed` and `plates[].n_structures` were
  stale; `plate_frame.validation` quoted a label count from an earlier pass; the
  `thalamus` alias resolved to nothing.
- The About dialog's build hash was hand-edited and 83 commits old.
- `build_region_extents.py --plates` and `build_volumes.py --plates` wrote a partial block
  over the committed data; they now refuse. `qc/` is created before the long compute.
- `find_missing_labels.py --qc` promised a file it never wrote; it now writes one per plate.
- `find_missing_labels.py` re-typed the page-to-plate frame constants it already imported.
- `check_indexes.py` reported one section's disagreements under another's heading and
  had no `--help`.
