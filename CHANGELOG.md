# Changelog

All notable changes to this repository are recorded here. `data/gerbil_atlas.json`
carries a `version` block naming the release its derived fields were built for.

## [Unreleased]

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
  62 plates; the other is `och` on plate 22, still dropped.

  `OV` on plate 5 outlined the bulb's outer layer instead of the ventricle its line points
  at. `E/OV` is one label of two names and one line, and only one of the two boxes can be the
  one the march reached — the other kept the printed position, out beyond the section, and was
  snapped into whatever face was nearest. A line is recorded against every name in the label
  it was drawn from now, and the march aims at the label rather than at one word of it, which
  is what finds plate 5's right-hand line at all: it passes 1.4 px off the corner of `E` on
  its way to the gap between the two words. 215 lines answer for 233 boxes.

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
