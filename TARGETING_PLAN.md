# Plan — the Brain Region Targeting Tool

A design for a tool that plans an electrode or injection track to a named structure:
you pick a target and a hemisphere, set the approach angles, and it gives you the entry
point, the angles to dial into the manipulator, and how far to drive from the brain
surface — drawn live on the plate, the projections and the 3-D view, and recoverable
from a link.

Nothing here is built yet. This document is the plan:
[issue #1](https://github.com/dstolz/GerbilAtlasExplorer-tasks/issues/1) asked for one.
It settles the questions that have to be settled before code is worth writing — which
frame the angles live in, where the brain surface comes from, and what the tool is
allowed to claim — and states what was checked to settle them.

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

### Three angles, two of which do anything

Compose in the same order `frmBuild()` uses, yaw then pitch then roll, so there is one
convention in the app rather than two:

```
tilt   about ML, + = tip driven posterior      (a nose-down-looking approach)
roll   about AP, + = tip driven toward the right
yaw    about DV, + = rotation of the tilt's heading
```

`FRM` is `R_roll · R_pitch · R_yaw`, and `R_yaw` fixes the DV axis. So **with tilt and
roll both zero, yaw does nothing at all** — it spins the probe about its own axis, and a
straight probe has no way to show that. This is not a bug to be fixed but a fact to be
surfaced: the UI should fade the yaw control and say *"yaw turns the tilt; with no tilt
there is nothing to turn"* rather than let a user set 30° of it and watch the picture
refuse to move.

Two angles set the direction; the third names which way the first two are aimed. Report
all three anyway — a manipulator has three knobs and a note that omits one is a note you
cannot follow.

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
converts to millimetres.

**This was checked, not assumed.** Running that flood fill offline over plates 20, 30 and
45 with the app's own crop (`V3C = [14, 14, 1020, 681]`) and threshold (min channel < 236)
returns the section as exactly one surviving component out of ~400, on each plate. The
dorsal edge lands where the atlas's DV convention says it must — DV 0 is defined as the
plane through the most dorsal points of cerebrum and cerebellum, and on plate 30 the
extracted surface reads **−0.02 mm at ML −4, +0.40 at ML −2, −0.08 at ML 0, +0.43 at
ML +2, −0.06 at ML +4**. Symmetric to about 0.03 mm, and within about 0.4 mm of the plane
it is supposed to define. That residual is the outline stroke's own width plus wherever
that particular level sits relative to the vertex; it is a bias to state, not to hide.

**Precompute it, do not derive it at runtime.** The runtime version only exists once the
3-D view has been opened and takes seconds to build. Extract the outline offline and ship
it in `gerbil_atlas.json` as a new `brain_outline` block — one closed polyline per plate,
in the same `[x, y]` image fractions `label_positions` already uses, so it reads with the
same two formulae. That also makes it a thing that can be looked at and argued with,
rather than a side effect of a shader.

Ray/surface intersection then works on a stack of 62 outlines: walk the track from the
target outward and take the first crossing. Between plates the surface is linearly
interpolated, exactly as the 3-D view interpolates everything else, and the note has to
say so — the sections are 350 µm apart, so the entry AP is quantised at 350 µm however
smooth the drawn line looks.

### What this surface is and is not

- It is the **outline of a fixed, sectioned brain**, not the in-vivo dural surface. The
  brain sits lower under intact dura and lower again after it is opened. Treat the depth
  as a plan to check against your own surface reading, not as a number to drive blind.
- Laterally the outline is the side of the section. A track that enters there enters
  through temporal bone, which is a real approach but not a dorsal one — at 30° of roll
  toward MSO the entry lands on the flank at DV −2.50, and the tool should say the entry
  is lateral rather than quietly report a depth.
- It is the **drawing's** outline. The Nissl and myelin plates are registered to the same
  box, so the same extraction runs on them; the drawing is the one to ship because its
  contour is drawn rather than stained, and its edge is therefore the one the atlas
  intends.

## What it reports

For a target, a hemisphere and three angles:

```
Target       MSO, right · plate 45 · lambda −3.15 · ML +1.35 · DV −8.20
Entry        lambda −3.15 · ML +4.03 · DV −0.83        (surface)
Angles       tilt 0° · roll 20° · yaw 0°
Drive        7.84 mm from the surface along the track
Vertical     8.33 mm if you went straight down at the target's ML
```

The `Drive` and `Vertical` figures above are real: computed from the extracted plate-45
outline against the published `MSO` label at ML +1.35 / DV −8.20. A vertical approach
crosses 8.33 mm of brain; a 20° lateral approach shortens the track to 7.84 mm and moves
the entry 2.7 mm lateral. That the angled track is *shorter* is not an error — it enters
on the shoulder of the section, above the ML at which the vertical one enters.

**The right triangle.** The issue asks for the track's legs plotted with the track as
hypotenuse, and they are worth having because they are what you set on the arm before you
lower it: the pure-DV leg and the horizontal offset from entry to the point above the
target. For the 20° case that is 7.37 mm down and 2.68 mm across. Drawn as two thin
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

Each stage is useful on its own, which is the point of the ordering.

1. **Extract the outlines offline** and add `brain_outline` to `gerbil_atlas.json`, with
   the extraction written up in METHODS.md the way the label reading and the plate
   calibration already are. Check every plate for a single surviving component, and check
   the dorsal reading against DV 0 near the vertex. This is the stage that can fail, so it
   goes first.
2. **Vertical approach only.** Target, hemisphere, depth from surface. No angles, no new
   convention, and it already answers the most common question.
3. **Angles**, the working-frame math, and the plate and projection overlays.
4. **The 3-D line**, the right-triangle construction lines, notes export and the `tg` link.

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

It should ship behind the same *experimental* wording the frame adjustment carries, until
somebody has driven a track by it and looked at the section afterwards.
