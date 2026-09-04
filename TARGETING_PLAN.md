# Plan — the Brain Region Targeting Tool

A design for a tool that plans an electrode or injection track to a named structure:
you pick a target and a hemisphere, set the approach angles, and it gives you the entry
point, the angles to dial into the manipulator, and how far to drive from the brain
surface — drawn live on the plate, the projections and the 3-D view, and recoverable
from a link.

**Built.** This was the design
[issue #1](https://github.com/dstolz/GerbilAtlasExplorer-tasks/issues/1) asked for, and it
is kept here as the record of what was decided and why — which frame the angles live in,
where the brain surface comes from, and what the tool is allowed to claim. It has been
updated where building it changed the answer, and those changes are marked. For how the
shipped tool actually works, see [METHODS.md](METHODS.md#planning-a-track).

Three things moved between plan and build, all noted in place below: the angle
composition order, the decision not to interpolate between plates, and a millimeter-sized
arithmetic error in the first surface extraction that three independent checks caught.

## What already exists

Most of the machinery is in `gerbil_atlas_explorer.html` already, which is why this is
worth building rather than a rewrite.

| Piece | Where | What it gives the tool |
| --- | --- | --- |
| Structure coordinates | `coordsOf()`, `ptsOf` | the target, per hemisphere, in atlas mm |
| Working-frame transform | `toFrame()` / `fromFrame()`, `FRM` | the user's own pitch / roll / yaw and origin |
| Two-point measure | `drawMeas()` | in-plane distance and angle from vertical, already |
| Plate overlay | the `<svg id="ov">` groups | somewhere to draw the track on the plate |
| Projections | `pj()`, `pjAxes()` | AP × DV and AP × ML, already in mm |
| 3-D line drawing | `pLine` / `V3_LINE` | a track in the stacked view |
| Section silhouette | the flood fill in `v3build()` | **the brain surface** — see below |
| Deep links | `writeHash()` / `readHash()` | plan restoration, with a back-compat discipline to copy |

The tool is mostly a matter of composing these. The two genuinely new things are a brain
surface to measure from and a second angle convention to keep straight against the first.

## Where the angles live

**In the working frame, not the atlas frame.** This is the decision everything else hangs
off, so it is worth being blunt about.

The atlas is cut perpendicular to the brainstem axis. **Frame** already lets you say how
your head sits relative to that — a pitch, roll and yaw of the *head*, described in
[METHODS.md](METHODS.md#your-own-coordinate-frame). The targeting tool's angles are a
different thing: the orientation of the *electrode* relative to the frame you zeroed in,
which is what you actually dial into a manipulator. Putting the tool's angles in atlas
coordinates would mean a user with a 17° head pitch reads a number they cannot set on
their rig.

So: the target comes from the atlas, is carried into the working frame by `toFrame()`,
the track is built there, and the result is carried back by `fromFrame()` only to draw it
on the plates. Every number the tool reports is a working-frame number. With no frame set
the two coincide and nothing is lost.

The default is **vertical dorsal** — straight down the working frame's DV, which is the
`(0, 0, −1)` direction — and it is the default because it is what most people do and
because it is the case where the report is unambiguous.

### Three angles, two of which set the direction

```
tilt   about ML, + drives the tip anterior      (entry behind the target)
roll   about AP, + drives the tip to the right  (entry left of the target)
yaw    about DV,   turns the heading the other two aim in
```

**Yaw has to go outside the other two, not inside.** This section first proposed composing
in `frmBuild()`'s order, `R_roll · R_pitch · R_yaw`, so that one convention served the
whole app. That is wrong here, and the reason is worth keeping: `R_yaw` fixes the DV axis,
so a yaw applied to the down vector *first* leaves it untouched — and then everything after
it is applied to an unchanged vector. Composed that way the yaw field would be inert at
**every** tilt and roll, not just at zero. Built as `yaw ∘ tilt ∘ roll`, it re-aims whatever
direction the first two produce, and is inert only while both of them are zero.

That is still a fact to surface rather than a bug to fix: a straight probe spun about its
own axis points where it pointed before. The built tool disables the field then and says
*"the track is vertical, so yaw has nothing to turn"*, rather than letting someone set 30°
of it and watch the picture refuse to move.

So there are two composition orders in the app, deliberately: the Frame dialog turns the
animal, this turns the probe. Each angle is named by what it does to the tip, which is the
same rule the frame uses for the head.

Two angles span every direction; the third is redundant, and reported anyway — a
manipulator has three settings and a note that omits one is a note you cannot follow. The
panel also gives the resulting direction as one angle from vertical plus a heading in
words, which is the form to check against the rig.

## Where the brain surface comes from

The issue asks for "the distance from the brain surface to the target". The atlas ships
no segmentation and no brain surface. The skull mesh in `window.__SKULL__` is bone, from a
different animal, aligned here rather than published — the README already says not to
measure against it. It is the right surface for *where to drill* and the wrong one for
*how far to drive*.

The surface is instead recoverable from the plates themselves, using code the app already
runs. `v3build()` floods the paper in from the border of each cropped plate, keeps the
connected components above a floor, and gets the section as a single blob — that blob's
outline **is** the brain outline at that level, in plate pixels, which `plate_frame`
converts to millimeters.

**This was checked, not assumed.** Running that flood fill offline with the app's own crop
(`V3C = [14, 14, 1020, 681]`) and threshold (min channel < 236) returns the section, and
the dorsal edge lands where the atlas's DV convention says it must: DV 0 is the plane
through the most dorsal points of cerebrum and cerebellum, and over all 62 plates the
**highest point of any outline is DV −0.06 mm**. The surface reaches that plane and never
crosses it. The lowest is DV −9.09, and the deepest printed label sits at DV −9.02, just
inside it.

Getting there took one correction worth recording, because it is the kind of error a
plausible-looking answer hides. The first pass read the plate pixels with
`dv_zero_px` as the pixel of DV 0, which is what the JSON's own formula does — but the app
uses `DV_Y0 = dv_zero_px − dv_px_per_mm`, the pixel of DV **+1**. Every extracted height
was a millimeter high, which put the brain's apex at +0.94 mm and made it look as though
the surface floated most of a millimeter above the plane that defines it. Corrected, the
three independent checks above agree to within 0.07 mm. **Read the app's constant, not the
JSON's prose.**

**Precompute it, do not derive it at runtime.** The runtime version only exists once the
3-D view has been opened and takes seconds to build. Extract the outline offline and ship
it in `gerbil_atlas.json` as a new `brain_outline` block, in the same `[x, y]` image
fractions `label_positions` already uses, so it reads with the same two formulae. That also
makes it a thing that can be looked at and argued with, rather than a side effect of a
shader.

**Not one polyline per plate — a list of them.** The drawing genuinely separates in three
places, and a reader that kept only the largest blob would silently lose a hemisphere: the
interhemispheric fissure splits plates 10–14, the cortex parts from the midbrain on 37–42,
and the cerebellum from the brainstem on 56–59. 81 polygons over the 62 plates.

Ray/surface intersection then walks the track from outside toward the target and takes the
first crossing. **Nothing is interpolated between plates** — this is a change from what
this section first proposed. At 350 µm spacing an interpolated surface would be arithmetic
rather than anatomy, which is the objection the 3-D view's streaking already carries; the
surface is the nearest plate's, and the entry AP is quantized at the section spacing.

### What this surface is and is not

- It is the **outline of a fixed, sectioned brain**, not the in-vivo dural surface. The
  brain sits lower under intact dura and lower again after it is opened. Treat the depth
  as a plan to check against your own surface reading, not as a number to drive blind.
- Laterally the outline is the side of the section. A track that enters there enters
  through temporal bone, which is a real approach but not a dorsal one — at 55° of roll
  toward `MSO` the entry lands on the flank at DV −6.52 with 5 mm of brain above it, and
  the tool should say the entry is lateral rather than quietly report a depth.
- The contour runs a few pixels out along the leader lines the drawing uses to point at
  labels printed beside the section. A morphological opening would take those off, and was
  tried: at a radius that removes them it also eats the thin cortical sheet on plates 36
  and 38, and the labels falling outside their own outline go from 135 to 316. Leave the
  outline honest and make the *reader* robust — take the first crossing followed by 0.2 mm
  of brain, not the first crossing outright.
- It is the **drawing's** outline. The Nissl and myelin plates are registered to the same
  box, so the same extraction runs on them; the drawing is the one to ship because its
  contour is drawn rather than stained, and its edge is therefore the one the atlas
  intends.

## What it reports

For a target, a hemisphere and three angles:

```
Target        MSO · right · plate 46 · AP −7.95 · ML +1.31 · DV −8.30
Approach      25° from vertical, tip toward left
Entry         AP −7.95 · ML +4.33 · DV −1.83
Drive         7.14 mm from the surface to the target
Sides         6.47 mm down · 3.02 mm across
Straight down 7.51 mm
```

Those figures are real — the built tool's, against `MSO`'s label center. A vertical
approach crosses 7.51 mm of brain; a 25° lateral one is 7.14 mm and enters 3 mm further
out. That the angled track is *shorter* is not an error: it enters on the shoulder of the
section, where the surface is already lower.

**The right triangle.** The issue asks for the track's legs plotted with the track as
hypotenuse, and they are worth having because they are what you set on the arm before you
lower it: the pure-DV leg and the horizontal offset from entry to the point above the
target. For the 25° case that is 6.47 mm down and 3.02 mm across. Drawn as two thin
construction lines on the plate and in the projections, behind a toggle, off by default.

**Notes** go out as a copyable block and a download — plain text, one field per line, with
the frame spec the CSV export already writes so a note read six months later says which
zero it was measured from.

## Restoring a plan

One hash parameter, `tg`, carrying target, hemisphere and the three angles:

```
&tg=MSO,R,0,20,0
```

Written by `writeHash()` only when the tool is on, so every link ever written still reads
back unchanged. `readHash()` should read it positionally and tolerate a short list, the
way the frame's `fr` already tolerates the nine-value form written before the origin
existed — the comments around that code are the discipline to copy.

The frame is already carried by `fr` / `fo` and is already sticky. A plan link is only
meaningful together with the frame it was planned in, so `tg` without `fr` means the atlas
frame, and the note should print the frame spec so a mismatch is visible rather than
silent.

## The views

**Plate.** A new `<g id="tk">` in `<svg id="ov">`, after `#ms` so the measure tool stays
on top. Draw the track's projection into the plane, the entry dot on the surface and the
target dot. The honest thing to say, and the tool should say it: on a tilted track only
the point where it crosses this plate's AP is actually on this plate. Draw the rest thinner.

**Projection.** The track is a straight line in AP × DV and in AP × ML — this is the view
where a tilt reads correctly, so it is the one to show a tilted plan in. The projections
currently fall back to atlas coordinates under a rotated frame and say so; the track has
to obey the same rule, which means drawing it through `fromFrame()`.

**3-D.** A line through `pLine`, with the entry and target as points. The existing
`v3near()` hover picking should include them so they can be read.

Real-time in all three means the recompute is cheap: one ray against 62 short polylines,
which is microseconds. Redraw on every angle change, no debounce beyond the existing
`queueHash()`.

## Workflow

Following the issue's steps, as a third mode in the left panel's `#mseg` — beside
**Find a structure** and **At a coordinate** — rather than a fourth view tab, because the
track has to be visible in all three views at once.

1. **Pick the target.** Reuse the existing search and result list; a structure with no
   located label has no coordinate and the tool must refuse rather than guess. Twenty of
   the 723 are in that state. Hemisphere is a left/right toggle, defaulting to whichever
   side has more located labels.
2. **Set the angles.** Three number fields, defaulting to 0 / 0 / 0. Yaw faded while tilt
   and roll are both zero, with the reason given.
3. **Read the plan.** Entry, angles, drive depth, and the vertical comparison, updating live.
4. **Export.** Copy notes, download notes, copy link. The PNG export should pick up the
   track overlay, since `exportPNG()` already redraws the overlays onto a canvas.

## Build order

Each stage was useful on its own, which was the point of the ordering. All four are done.

1. **Extract the outlines offline** and add `brain_outline` to `gerbil_atlas.json`, written
   up in METHODS.md the way the label reading and the plate calibration already are. This
   was the stage that could fail, so it went first — and it is where the DV error above
   was caught, by a check that had been written down before the number was known.
2. **Vertical approach only.** Target, hemisphere, depth from surface.
3. **Angles**, the working-frame math, and the plate and projection overlays.
4. **The 3-D line**, the right-triangle construction lines, notes export and the `tg` link.

What it cost, once built: 8,815 points of outline, about 152 KB wherever it is stored, and
about 0.9 ms per solve — so the track redraws on every keystroke without a debounce, as
planned. The app went from 17.37 MB to 17.55 MB, outline and code together.
All 703 structures with located labels solve at three angle settings each without an
exception, a non-finite number or an out-of-range length.

## What it will not do

Worth writing down now so it does not have to be argued later.

- It plans a **straight track to a printed label's position**. A label marks where an
  abbreviation is printed, not the structure's centroid — the README's warning applies
  with full force here, because a targeting tool invites more trust than a coordinate
  readout does.
- It does not know about **vasculature, the sinus, or the ventricles**. The outline is a
  silhouette; a track that runs through a ventricle is drawn no differently from one that
  does not.
- It does not check the entry against the **skull**. That would need the skull overlay to
  be something to measure against, and it is not.
- It is not a **resectioning**. As with frame adjustment, this is a rigid construction on
  published numbers, carrying the atlas's own error, your alignment error and
  animal-to-animal variation.

It ships behind the same *experimental* wording the frame adjustment carries — in the
panel, in About, in the README and in the exported notes — until somebody has driven a
track by it and looked at the section afterwards.

## Since this plan

The planner now also reads the structures a track passes through, takes a probe length
and a footprint radius, and writes the plan as JSON; the method and its limits are in
[METHODS](METHODS.md#what-the-track-passes-through). The questions this plan settled —
which frame the angles are in, the order of the three, where the entry is found — are
unchanged by any of it.
