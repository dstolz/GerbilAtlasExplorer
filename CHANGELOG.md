# Changelog

All notable changes to this repository are recorded here. `data/gerbil_atlas.json`
carries a `version` block naming the release its derived fields were built for.

## [Unreleased]

### Added
- **One press of Commit sends every plate and every region a reader marked.** The fixer
  kept a draft per plate and sent the plate on screen, so a reader who walked the atlas
  marking `E` on plate 1, then plate 16, then plate 3, pushed one and left the rest parked
  in the page -- which is what happened to "corrections for most of E across several
  plates" (#119), a file for plate 16 alone. **Commit now takes every plate that holds marks,
  and on each plate one file for each region marked on it** -- a seed and an extent carry
  the region they were made for, and a boundary now carries the region that was chosen when
  it was drawn -- and sends them as one commit on one branch: `correction/<id>` for one file
  as before, `correction/<stamp>` for several, the stamp being the moment they were sent and
  the prefix of every id on it. The sheet lists the files with a line for what is wrong on
  each plate, editable there, so a plate marked and left without a word can be given one
  before it goes. One picture a plate goes beside its files, and the page walks to each
  plate to take it, which is what a reader would do to look. After a push the plates sent
  are cleared; a dry run leaves them. Both backends take the same list, and `apply-correction.yml`
  already applies every file a branch adds. `tests/python` and `tests/js/fixer.spec.js` each
  send three corrections on two plates and read the three files back.

- **The site can count how many people open it, with no cookie and nothing on the page.**
  GitHub Pages keeps no logs and offers no analytics -- the repository's own Insights ->
  Traffic counts visits to github.com, not to the site -- so a count has to come from the
  page itself. [GoatCounter](https://www.goatcounter.com) is what the head of `src/app.html`
  now loads: cookieless, nothing stored in the reader's browser, nothing kept that names a
  reader, and nothing visible, because the numbers live on its dashboard rather than in a
  badge here. What it sees is the path, the referrer and the headers a browser sends anyway;
  the plate, the structure and the view this page keeps in the URL are a hash, and a hash
  never leaves the browser, so the dashboard reads one path rather than one per plate.

  The counts go to `gerbilatlasexplorer.goatcounter.com`. `CODE` in that block is the site
  code that names it, and emptying it is how counting is turned off: nothing is then fetched
  and nothing is sent, and the page is the page it was before the block.

  Whether to count is settled in the browser rather than at build time, because one of the
  two built pages is both at once. `gerbil_atlas_explorer.html` is what Pages serves *and*
  the offline bundle -- attached to every release, opened from disk on a rig computer that
  may have no network at all -- so a build-time switch would put the same phone-home line in
  a file somebody downloaded. Only a page actually being served from `dstolz.github.io` is
  counted, which is false on `file://`, on the local server the browser specs run against,
  and on a fork's own Pages site, where the counts would not be this one's anyway.

  `tests/js/count.spec.js` pins that. It lifts the block verbatim out of the built page,
  swaps a code of its own into it and serves it from two hosts -- the site's and another --
  so what is asserted is the host test rather than whatever code happens to be committed,
  with GoatCounter itself intercepted, so no run of the suite reaches the network. Beside
  that it checks the two built pages as a reader gets them anywhere but the site: opened
  from disk and off a local server, neither fetches anything and neither puts the counter on
  the page. The code the pages do ship with is checked once, on its own, so a rebuild cannot
  quietly lose it.

- **A note on the first visit, saying whose atlas this is and that some of it is drawn
  wrong.** The page opened straight onto a plate with outlines over it, and an outline here
  is drawn in the atlas's own frame, on the atlas's own plate: without being told otherwise a
  reader takes it for a line the authors published. It is not -- it was cut from their
  drawing by this repository's own code -- and every honest thing the page has to say about
  its own accuracy is downstream of that one fact. So a modal note now opens **once per
  browser**, before anything has been read off a plate, and says four things. The atlas is
  Radtke-Schuller et al. (2016), and that is the work to read and to cite. The outlines were
  cut here rather than taken from the authors, so a boundary can sit in the wrong place, a
  region can take in ground that is its neighbor's, and a structure the atlas prints on a
  plate can come out with no area on it at all -- the printed plate underneath every overlay
  is the authority. The site is still being built. And the footer carries **Report a drawing
  error**, which opens a report with the region, the plate and what the page already knows
  about how that boundary got there filled in, with **Request a feature**, **Report an
  issue** and **About the data** beside it. **I understand** dismisses the note, and
  `gae-welcome` in the browser's own storage keeps it dismissed.

  There is no Close in its header and the backdrop does not dismiss it: it is the one dialog
  nobody asked for, so it should not go away on a stray click beside it. Escape does, because
  a modal the keyboard cannot leave is a trap, and it counts as read like any other way out
  -- a note that came back because the reader reached for a key would be a bug rather than a
  second chance. What is stored is the version of the note that was acknowledged rather than
  a bare flag, so raising `WELC` brings it back for everyone if what it says materially
  changes; a browser that refuses storage throws instead of answering and is shown the note
  every visit, which is the right way round for a note whose whole job is to be seen at least
  once.

  Every other browser spec now opens the page as a reader who has been here before, seeded
  through `tests/js/gae.js` before the page's own script runs. A modal over the page is a
  backdrop that swallows every click a spec makes, and without that this note would have
  turned nine green spec files red for a reason none of them is about;
  `tests/js/welcome.spec.js` is the one spec that does not use it, and checks what a browser
  that has never been here sees.

### Changed
- **METHODS.md is brought up to the data and cut by a third.** Every figure in it was read
  again off the current build, and the ones that had drifted are moved: 6,349 located labels
  (6,345), 3,351 of 3,514 structure-plate entries with a label, region extents at 96% of the
  located pairs and 92% of the index's, 3,435 faces named by one abbreviation (3,472), 112
  mirrored seeds (123), 171.3 mm2 returned to the regions (184), 27 joined labels on 42
  plates over 52 occurrences (22/31/37), 279 labels pulled to the nearest face and none
  dropped (192 and one), unassigned faces a mean 4% of section area (6%), the worst plate's
  section-area residual 0.7% (2.4%), the leader pass's 12 rejected and 2 dropped lines and
  its 26/38 odd tips (8/54), the label-pointing snapshot recomputed from the data
  (5,402 outlines, 552 names, 297 no region, 98 no extent), 4,473 touching pairs and
  198/95/103/77 in the coloring (4,506 and 189/89/105/78), 4/6/52 plates at six, seven and
  eight colors, 475 division-plate pairs (454), and in the volumes 689 structures (697), 40
  bridged holes (44), 427/262 grades, area residual 1.2%/5.6% (1.4%/6.7%), 79% of
  structures in one or two pieces with a 14% remainder (74% and 16%), and the 3-D
  containment figures. Twenty-six more of those numbers are now markers that
  `export_tables.py --refresh-db` rewrites from the database and the volumes, so they
  cannot drift again; the figures no committed script reproduces are said to be measured
  when they were. The prose is condensed throughout, from 23,900 words to 16,300, with the
  sections, anchors, tables, code blocks and every technical claim kept.

- **A correction reaches its pull request with fewer runs, and two corrections in flight
  no longer conflict with each other.** The first two corrections to go the whole way,
  `RAPir` on plate 28 (#109) and `E` on plate 3 (#110), took fifteen runs of the workflow
  between them for two applied fixes, and every merge of main after a fix conflicted in
  every derived file -- the volumes, the label volume, the pages, the summaries, the
  `seed_overrides` note, the changelog -- each resolved the same way by hand: main's derived
  files, the branch's input laid on them, the pipeline run again. `CORRECTION_PROCESS_PLAN.md`
  is the account; this is what it asked for.

  *The merge is a script.* `tools/corrections.py rebase` merges main taking main's copy of
  every derived file (`atlaslib.DERIVED_PATHS`, `DERIVED_BLOCKS`), lays the branch's input
  rows (`INPUT_BLOCKS`, per plate) on main's database, refuses the one case a person has
  to decide -- both sides changed the same plate's input -- runs the pipeline again, and
  commits the merge only when the re-cut does what the branch did: the same (plate, region)
  entries move against the new base as moved against the old, less any main moved itself,
  and the corrected region's rings are identical. `rebase-corrections.yml` runs it on every
  open correction pull request each time main moves, one branch at a time, and puts CI on
  the new head; where it stops it says so on the pull request. `apply-correction.yml` runs
  it before the session, in place of the session's own merge.

  *The session does what only it can.* The workflow runs `inspect --qc` and hands the
  session its output; `tools/pipeline.py rebuild` and `check` are the six build steps and
  every check as two commands, in the order and with the completeness the skill used to
  spell out over fifteen lines; `tools/corrections.py report` gives the write-up its
  numbers -- the region before and after, per hemisphere and over the series, every entry
  and volume that moved, the summaries side by side -- as Markdown against `origin/main`,
  so they are the same numbers a rebase prints and a reviewer can regenerate. The session
  writes `build/pr.md` and the workflow opens the pull request from it, with the picture
  pinned to the pushed head; the session needs no `gh` and no Node, and Playwright runs in
  CI on the push. A correction run may not edit `tools/`, `src/`, `tests/` or the
  workflows (the skill's Never list): run 13 of the workflow fixed the site-picture window
  in `tools/corrections.py` while #112 fixed it on main.

  *Fewer runs.* `fixer.html` pushes the file and its snapshot as one commit through the
  Git Data API, where two `contents` PUTs were two pushes and two dispatched sessions
  queued on one branch. The dispatch fires only when the pushed commit has one parent and
  adds a correction file on it (`tools/ci/correction.sh pushed`), so a merge of main into a
  branch that already carries its fix no longer starts a forty-minute session that finds
  nothing to apply; and a dispatched run that finds the fix already on the branch stops
  before it installs anything, unless `force` is set. The workflow's shell lives in
  `tools/ci/correction.sh`, tested by `tests/python/test_ci_scripts.py` against a
  repository the test makes, and `dry_run` runs every step but the session -- four
  plumbing pull requests in one day (#105, #106, #107, #111) were each a step that could
  only be tried on a runner.

  *Less to conflict on.* `CHANGELOG.md` merges with git's `union` driver (`.gitattributes`),
  which a local merge -- the rebase -- honors, so two entries added at the top of
  `### Fixed` keep each other. The totals `METHODS.md` states that a re-cut moves --
  entries, polygons, points, the coloring's regions and patches -- sit between
  `<!-- n:... -->` markers naming the database field they come from, and
  `export_tables.py` rewrites them on every run and holds them with `--check`; nobody
  restates a total by hand, and a rebase carries the right one. The `seed_overrides` note
  is static: it had grown a paragraph per correction and a count, and was a line every
  correction conflicted on; a row's reason is in the row, and the changelog carries the
  entry. The committed pages carry their build tokens unstamped -- nothing serves them,
  `pages.yml` stamps the copy it deploys, and `--check` already compared unstamped -- so
  three files stop conflicting between any two branches whatever they change.
  `data/gerbil_atlas_volumes.json` is written one structure per line, so a re-cut diffs by
  structure instead of as one 20 MB line, and it and the NIfTI are `-diff`. The NIfTI's
  gzip header carries no time and no name now: the same label volume was a different file
  on every rebuild, which made a binary that conflicted between any two branches out of one
  that had not changed. What a reader saw in **Recut** travels with the correction as its
  `preview`, and `report` says whether the applied fix agrees with it.

  Checked: `tests/python`, the eight new shell tests and the report and marker tests among
  them; every `--check` on the rebuilt tree, the volumes coming out equal as JSON and the
  label volume equal decompressed; and the rebase replayed on the real case -- the `E` fix
  as it stood on its old base (1f2206f), onto a main carrying #108 and #109 -- which is
  reported in the pull request.

- **A correction's pull request opens with a picture of the region before and after.**
  What a reader had was `qc/chk_corr_<id>.png` in the diff: the whole plate at twice its
  size, most of it white, the region a green sliver in the middle, and one state of it --
  the plate as it stood when `inspect --qc` last ran. `inspect --qc` now writes a second
  file beside it, `qc/chk_corr_<id>_site.png`: the site of the correction cropped to
  everything the correction is about (the region either side, the seeds, the boundaries,
  the extents, the boxes of its name, a quarter of that around it), and side by side --
  the region as it stands on `origin/main`, cut from that ref's database and tracing read
  out of the object store, beside the region as it stands in the checkout, each panel
  captioned with the area. Run after a rebuild, that is the picture of what the fix did;
  run before one, both panels are the same and say so. `--before REF` names another ref,
  and a ref the checkout cannot read gives the one panel and says why.

  The session commits both files and **opens the pull request body with the site
  picture**, embedded from the pushed commit's own URL so it stays with the pull request
  after the branch is gone (step 8 of `.claude/skills/atlas-region-fix/SKILL.md`, and the
  workflow's prompt). The whole-plate picture is drawn by the same code as before and
  comes out byte for byte the same; the test checks that, and that the site picture has
  two panels against `HEAD` and one against a ref that does not exist.

- **A correction stops at its pull request, to be read before it lands.** The workflow
  squash-merged the fix onto main itself the moment CI went green, so what the atlas says a
  structure is -- its area, its boundary, its mesh, its share of the label volume -- would
  have changed on the word of one unattended session. Which of the four causes a plate shows
  is a judgment made by reading the drawing, and it is worth a second pair of eyes. So the
  run waits on ci.yml, writes the pull request into the job summary, and stops there;
  **merging is the reader's**. What there is to read is the write-up and its numbers -- the
  region's area before and after, what else on the plate moved and why,
  `boundary_edges_shared_exactly` -- and `qc/chk_corr_<id>.png`, which the session commits
  with the fix now, `qc/` being where this repository has always kept the render that shows
  a build was right. The correction file is what a reader drew; that picture is what it did.

  The prompt closes the other way out of the job. A session with nobody at the other end
  that meets an either/or -- and `RAPir` on plate 28 is one, `inspect` offering it a seed of
  its own or a `label_index` that withdraws the printed box -- can end its turn having
  decided nothing, which is what both runs of it did. It is now told to take the reading the
  drawing supports, apply it, and put in the pull request which it took, what the
  alternative was and what would tell them apart, a question being answerable by the person
  who reads it and not by a run that has already ended. Stopping is for the plate that
  supports none of the four causes, and there the session's last message is the summary.

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

- **The lithoid nucleus is midbrain, not thalamus.** `Lth` carries the atlas's `thalamus`
  tag and was in `THAL` on that alone. The drawing puts it elsewhere: it is printed on plate
  33 and nowhere else, a paired nucleus at ML ±0.4 to ±0.7, DV −4.6 to −5.0, and every one of
  its six neighbours there is midbrain — the nucleus of Darkschewitsch, the interstitial
  nucleus of Cajal, the precommissural nucleus, the intermediate gray of the superior
  colliculus, the magnocellular nucleus of the posterior commissure and the p1 periaqueductal
  gray. That is the pretectal and periaqueductal company at the midbrain–diencephalon
  junction, not the dorsal thalamus. **`THAL` goes from 91 members to 90 and `MIDB` from 97
  to 98**, `BSTEM` with it, 286 to 287; no plate range moves, since plate 33 is inside both
  divisions already. The rule is a `drop` on the thalamus beside the one that excludes the
  hypothalamic nuclei, and an `add` on the midbrain, so the tag is still what the division
  starts from.
- **The hippocampal formation stops at the subiculum, and the belt beyond it is a division of
  its own.** `HIPP` had been the atlas's `hippocampal` tag with the hippocampal fissure taken
  out, and a tag is not an anatomy. It held 36 structures. Nine of them are the transitional
  cortex *around* the formation rather than part of it — the entorhinal cortices, the
  perirhinal and ectorhinal cortex, and the presubiculum, parasubiculum and postsubiculum.
  Three more are transitions *into* it from elsewhere: the amygdalohippocampal area, and the
  septohippocampal and septofimbrial nuclei, which are septal nuclei and were already filed
  under septum and basal forebrain.

  The line is now the one [Chauhan et al. (2021)](https://www.ncbi.nlm.nih.gov/books/NBK575732/)
  draw: the formation comprises the indusium griseum, the longitudinal striae, the gyrus
  fasciolaris, the hippocampus proper — cornu ammonis, dentate gyrus and subiculum — and part
  of the uncus, and the subiculum is where it ends, "continuous with the six-layered neocortex
  (para-hippocampal gyrus)". The entorhinal cortex in that chapter *is* the parahippocampal
  gyrus, named that way wherever it appears, so it is outside the formation.
  **`HIPP` goes from 36 members to 24**: the CA fields and their five layers, the dentate
  gyrus and its three, the four subicular entries, `IG` and `FC`, and the white matter the
  formation is built on (`alv`, `fi`, `f`, `df`, `dhc`, `vhc`). Its caudal end comes back with
  it, from plate 42 to plate 38 — bregma −6.55 to −5.15 mm — because what ran to 42 was the
  entorhinal cortex and the parasubiculum, not the hippocampus. This is a narrower formation
  than the one Amaral and Witter draw, which takes the entorhinal cortex and the whole
  subicular complex in. Where two definitions are in use the division follows the one it
  cites and writes its members out, so the broader one is still there to be read: it is
  `HIPP` and `PHR` together, less the perirhinal and ectorhinal belt.

  **`PHR`, the parahippocampal region, is the twenty-first division** and holds the nine that
  left: `PrS`, `PaS`, `Post`, `Ent`, `CEnt`, `LEnt`, `MEnt`, `PRh`, `Ect`, on plates 28–42,
  bregma −1.65 to −6.55 mm. Six of them carry the atlas's `cortex` tag and are in `CTX` as
  well; the three subicular cortices carry no tag at all and are in `PHR` alone, which is
  said in the division's own note. `CTX` and the four lobes are unchanged, and so is every
  other division — the diff is `HIPP` losing twelve members and `PHR` appearing. The three
  subicular cortices are the one placement the chapter does not settle: it names the
  presubiculum once, as what delimits CA1 laterally, and the parasubiculum and postsubiculum
  not at all. They are here on the reading that the subiculum is the last member it lists,
  and METHODS says so rather than claiming otherwise.

  The formation is written as the tag *minus* `PHR` minus those three transitions rather than
  as a hand list, which needed one new rule in `tools/build_groups.py` (`less`, subtract
  another division) and a resolution order that puts a division after the ones it reads
  instead of after the ones written above it. `test_groups_cover_the_atlas` now asserts that
  the two do not overlap, that between them they hold every `hippocampal`-tagged structure bar
  the fissure and those three, and that neither reaches outside the tag.

- **The tests stop repeating what CI already checks another way.** Thirteen of the 178
  tests asserted something a step beside them asserted first, and two of those could not
  fail at all. `pytest tests/python` is 70 tests in 70 s and is now 63 in 49; the browser
  suite is 102 tests where it was 108, in the same 7 minutes -- the six that went were a
  second or two apiece, because what the browser suite costs is building the 3-D stack, and
  none of that moved.

  Five were a build run twice. `test_committed_pages_current`, `test_tables_current`,
  `test_region_colors_block_is_a_fresh_build`, `test_groups_block_is_a_fresh_build` and
  `test_every_plate_has_a_face_map_the_page_can_read` are `build_app.py --check`,
  `export_tables.py --check`, `build_region_colors.py --check`, `build_groups.py --check`
  and `build_facemaps.py --check`, which CI runs in the same job a few steps earlier. The
  tools are the better half of the pair: each names the file that went stale and the command
  that rebuilds it, where the test could only say that two dictionaries differ, and
  `export_tables --check` reaches the derived fields in the JSON that no test ever read.
  `test_region_colors_block_is_a_fresh_build` alone was 14.5 s, a second full solve of the
  coloring. What the tests keep is what a rebuild cannot tell you: `test_region_colors` and
  `test_region_colors_patches_are_never_split_by_the_atlas` read the coloring back off the
  geometry, so a solver that agreed with itself and not with the section still fails.

  Two could not fail. `test_the_cut_gzips_the_same_way_twice` compared `gzip.compress(raw,
  6, mtime=0)` with `gzip.compress(raw, 6, mtime=0)` in one process -- the determinism it
  was written for is between runs, which is what `build_facemaps.py --check` compares.
  `test_unstamp_idempotent`'s one assertion is repeated verbatim by
  `test_build_stamp_carries_the_moment` immediately below it, under a stamp that carries
  more. `test_the_committed_face_map_is_the_cut_it_claims_to_be` kept the half that is
  nobody else's -- that a face id read out of the published raster and looked up in the
  sidecar is the answer `probe` gives from the live cut -- and dropped the byte comparison
  `--check` makes on all 62 plates rather than on plate 19.

  In the browser, `two regions that all but touch are never the same color` was the same
  brute force as `tests/python/test_data.py::test_region_colors` on 7 of the 62 plates
  instead of all of them, off the same committed extents. `stepping from one plate to the
  next repaints nothing` and `the same plate is the same picture in a second session` are
  the `moved` check in `every region on every plate carries a color`, which compares every
  pair of plates and not just consecutive ones. `a phone-sized window does not scroll
  sideways` ran once per page, and `on a phone the picture is on the first screen in every
  view` asserts it at the same 390 px across all three views. The build stamp is one
  `render()` for both pages, so it is read on one of them.

  What went with them: `.claude/skills/atlas-region-fix/SKILL.md` step 6 now names
  `build_facemaps.py --check`, and step 5 the rebuild that keeps it green -- the face maps
  are cut from `svg/`, so a corrected tracing leaves the published maps stale and the static
  fixer page answering **Pick** from an older cut, which the skill never rebuilt. The README
  lists the six checks beside the tests. Four spec files defined an `adv` helper none of
  them called.

- **A failing browser job says what the browser saw.** `playwright.config.js` takes
  `screenshot: 'only-on-failure'`, and CI uploads `test-results/` when the job is red
  instead of uploading the two built pages when it is green: the pages are a deterministic
  build of committed data and can be rebuilt from any checkout, and half of what these specs
  assert is layout. A screenshot costs a passing run nothing. (`trace: 'retain-on-failure'`
  records every test and throws most of them away; it measured about 15% on this suite,
  which is not worth paying on every green run.) The two local servers are also no longer
  reused under `CI`, where a port that answers is a server nobody started and a run green
  against whatever it happens to be serving.

- **The meshes open in a hue per structure.** The 3-D mesh **Color** control opened on
  *Selection*, which paints a division's members all in the division's one color. That is
  the right picture of one structure and the wrong one of sixty-five: a cortex in one teal
  is a blob that will not say which field you are looking at, and a division is the case
  that brings anybody to the meshes in the first place. **One per structure** is the default
  now, and it is listed first in the control; *Plate colors* and *Selection* are both a
  click away and unchanged. The note under the picture says what the colors are doing in
  every mode rather than only off the default, because a hue that is the first thing a
  reader sees is the one most likely to be read as meaning something, and it means nothing.
  A link still names a color only when it is off the default, so `&mc=plate` and `&mc=sel`
  are what carry the other two and a plain mesh link carries none.

### Fixed
- **A plate marked and left is written in its own millimetres, so a batch sent from the
  published fixer reaches its session again.** The page wrote every file of a Commit through
  the registration of whichever plate was on screen when Commit was pressed: `buildDoc` read
  `S.d`, which was the draft's own plate while Commit sent one plate, and stopped being so
  when it began sending every plate that holds marks. Sixty of the sixty-two registrations lie
  within 0.016 mm of one another, under the 0.02 mm `validate` allows, so nothing showed;
  plate 31's lies 0.83 mm of DV from the rest, and plate 20's is a quarter turn. #135 sent
  eleven corrections on seven plates, its plate-31 file said DV -4.273 where its own page px
  read -3.444, `tools/corrections.py validate` stopped `apply-correction.yml` at `Read
  them`, and the run ended before any session -- so none of the eleven was applied, and there
  was no pull request opening on its before-and-after picture. Each file is now read
  through its own plate's registration (`framesOf` in `src/fixer.js`), which is what
  `tools/atlasfix.py` always did behind the local page. The pipeline reads page px and never
  mm, so the other batch files sent this way moved nothing: their mm are off by 0.015 mm at
  most (`MiA` on plates 5 to 7), and only #135's plate 31 is outside the tolerance. #137
  recomputed that file's four mm pairs from its own page px, which are where the reader put
  the seeds, so main reads it again; this is the change to the page that wrote it, which #137
  held back. `tests/js/fixer.spec.js` marks plate 31 on the published page, leaves it for
  plate 19, and checks the file is the one written with plate 31 on screen and the one
  `atlasfix.py` writes.

- **The section outline follows the drawn line, and the gray blobs leave the SVG export.**
  The export drew, faint and gray, a scatter of small shapes hanging off the drawing on
  nearly every plate -- letter-shaped where a label sat on the section's edge. They were
  not Nissl and not the tracing: they were the "unnamed sealed faces" `region_extents`
  publishes, cut between the atlas's own red outer line and `brain_outline`, which had been
  taken from the page by a gray threshold alone and so was the photograph's edge rather than
  the drawing's -- one to six pixels outside the red line all the way round, and carrying
  every printed abbreviation and leader line that touched the section. 369 such faces over
  the atlas, 68,835 plate px, and 82 named polygons that reached out past the red line to
  the same edge.

  `brain_outline` is derived now, by `tools/build_brain_outline.py`, first step of
  `pipeline.py rebuild`, on one rule: **the drawn line wherever the atlas draws one along
  the section edge, the tissue edge where it draws none.** The tissue is read off the page
  with the black of the labels and leaders left out (a chroma test: stain is purple, the
  line is red, a glyph is gray), the paper is flooded in from the border, and the boundary
  of what it does not reach is snapped onto the traced ink wherever ink lies within 6 plate
  px -- 99.8% of the boundary lands on it; the rest is the open flanks, the cerebellum on
  53 and 57 and the optic nerve on 7, where the atlas draws no outer line and an outline
  from the tracing alone was tried and lost a tenth of the section. The tracing is in the
  flood's barrier as well as the stain, because the drawn line runs on under a printed word
  where the page shows only black, and the pale trigeminal root on plate 42, sealed by such
  a line, flooded with paper through its own label until it was. The two islands (och on
  22, ML on 36) are kept because they carry a label, by rule rather than by exception.

  What moved: the section is 1.8% smaller over the atlas, 1.0% to 6.0% on a plate, most on
  the olfactory bulb and the brainstem plates where the labels crowd the edge; 84 outline
  polygons where there were 83, the cortex now parting from the midbrain on plate 36 as the
  drawing has it; the highest point stays DV -0.06 and the lowest goes -9.09 to -9.04;
  printed labels inside their own outline 97.8% to 96.9%, the 115 that left being 54
  fissure and sulcus names printed in the cleft at the edge, which seed nothing, and words
  straddling the outer line, a median 0.16 mm out, which `region_extents` seeds from the
  nearest face as it always did for a word printed beside the section. In the regions: the
  unnamed faces on the outline go 371 to 7; 25 structure-plate entries lose the only area
  they had, each a word printed beside the section (`Mi` on the bulb plates, `LNTB` on 45,
  `LRtPC` on 57 and 58, `dsc` on 53 and 58) whose region had been the word's own ink on the
  photograph's edge, none of it inside the drawn line; `dsc` on 54 goes 0.27 to 0.13 mm2,
  the rest having been the offset ring round half the brainstem; and the lobules and bulb
  layers on the edge lose the one to four pixels of stain outside their outer line, 0.1-0.2
  mm2 each. `structure_plate_entries` 3,117 to 3,092, `polygons` 6,017 to 5,823,
  `label_inside_its_own_region` 0.975 to 0.973, `section_area_residual_worst_plate` 0.0101
  to 0.0070; `ALPO` and `MRe`, lettered on one plate each (44 and 34) and with no area
  left there, leave the volumes, 691 structures to 689; and three leader tips land in no
  region where they landed in their own -- IPl on 6 in the paper beside the bulb, cu on
  54 on the outer line itself, LRt on 56 a pixel outside it -- so `tests/python/test_leaders.py`
  reads 176/26/38 for 179/26/35 and 64 for 61. The extents, the volumes, the colors, the
  face maps, the tables, the geojson and the pages are re-cut from it; the numbers are in
  `tools/build_brain_outline.py`'s own output and in METHODS. `test_brain_outline` counts
  84 rings, `test_volumes_consistent` 689 structures, and `test_labels_inside_outline`
  holds 96.5%; `tests/js/colors.spec.js` counts 689 named regions, and `fixer.spec.js` reads
  S1DZ on plate 19 as 0.6141 mm2 (its outer edge is the section edge) in face #15, the same
  4,608 px face renumbered once the sliver faces went; `tests/python/test_outline.py`
  draws a page and checks that a word on the edge leaves neither a bump nor, once snapped,
  a bite. `brain_outline` moves from `atlaslib.INPUT_BLOCKS` to `DERIVED_BLOCKS`, so a
  `corrections.py rebase` rebuilds it rather than merging it.

- **The ependyma follows its own `E/OV` line into the olfactory ventricle, on twelve
  plates.** The atlas letters the olfactory ventricle with one compound label, `E/OV`, once
  per hemisphere on every plate from 1 to 15; it prints the label clear of the section, down
  by the ventral rim or below it, and draws a line from the word up into the slit it names.
  Almost none of those lines reaches the slit in `label_leaders`. Where the march stopped
  short, `E` seeded whatever face the tip fell in and the watershed cut it a share of that
  neighbour: **0.2246 mm² of the external plexiform layer on plate 7** out of the 21,312 px
  face `EPl`, `EPlA` and it share, **0.0367 mm² out of the 11,761 px block the anterior
  olfactory nucleus fills on plate 9** at a traced share of 0.63, and smaller wedges on 13,
  14 and 15. Where no line was found at all, the *word* seeded itself, and `E` came out as a
  strip of the nerve layer the word is printed on — a **1,417 px** strip on plate 1, **761 px**
  on plate 6. Twelve corrections, `20260910T134521Z-p01-E` through `-p15-E`, say the same
  thing on all twelve plates: positive seeds in the ventricle, negative seeds crossing out
  the ground `E` holds today.

  It is the seed in the wrong face on nine of the twelve, and the fix is a row of
  `seed_overrides` per misread box with `i` set, which withdraws the marched tip and puts the
  seed where the reader put it. **Both** names of the compound need one: `label_leaders`
  records the same tip against `E` and against `OV`, and `label_blocks` seeds a joined label
  under its first name, so a row for `E` alone leaves `OV`'s copy of the same tip seeding the
  same wrong face — which is why plate 7 keeps its wedge until the `OV` row goes in beside
  the `E` one. Twenty-six rows in all, on plates 1, 4, 6, 7, 9, 11, 13, 14 and 15. The
  correction files carry no `label_index`, so `corrections.py apply` would have written them
  as `i = −1`, seeds of their own *beside* the tips, and `E` would have kept the ground the
  negative seeds cross out; the rows are written through `atlaslib.save_db` instead, in the
  layout `apply` writes, and `corrections/` is untouched.

  Three plates are not that, and each is its own reading:

  - **Plate 8 — the join was never read.** The plate prints `E/OV` on both sides like its
    neighbours, but `label_blocks` carries no group for it, so the two names seeded as two
    regions and split the plate between them: the left line was recorded against `OV`, which
    took the whole 1,790 px slit, and the right against `E`, which took the 1,699 px one.
    `['E', 'OV']` on plate 8 is the fix, and it is the same row twelve other plates in this
    range already carry.
  - **Plate 11 — the label was never read.** The atlas prints `E/OV` on both sides of plate
    11 and `label_positions` had neither word, so nothing seeded the ventricle and `E` had no
    area on the plate at all. The four boxes are added by hand, read off the plate image
    against plate 12's recorded boxes as a check, with `['E', 'OV']` beside them and a row of
    `seed_overrides` per box carrying the end of each printed line. A `−1` row alone would
    not do: `test_region_extents` requires every published entry to have a printed box on its
    plate, and without one the plate-11 entry is a region the atlas never labelled here.
  - **Plate 3 — the seed in the wrong face was one of ours.** Correction
    `20260908T012002Z-p03-E` (#110) gave `E` the run of the slit above the pinch with a `−1`
    row; this reader crosses that run out with four negative seeds, and the drawing is with
    them. The printed `E/OV` line ends in the ventral spindle, 0.54 mm below the foot of the
    run, and the line that ends *at* the run is `aci`'s: followed to its own end it reaches
    page x 1803, four pixels off the run's lateral wall, where the leader pass stopped it
    63 px short of that in the bulb core. The row comes out; the run is unassigned again
    rather than handed to `aci`, because giving a fibre tract ground is a correction on
    `aci`, not on `E`.

  **`E` goes 1.580 to 1.679 mm² over the series** and **0.4268 to 0.6999 mm³ in 10 mesh
  components rather than 18** — the region was in eighteen pieces because on most of its
  plates it was somewhere else. Per plate, gains first: **0.0295 → 0.1624 mm² on plate 6**
  (one polygon to two, one per hemisphere), **0.0929 → 0.1884 on 8**, **0.1330 → 0.1927 on
  4**, **0.0367 → 0.1192 on 9**, **0.0237 → 0.0548 on 15**, and **no area → 0.0228 on 11**.
  Losses are the ground the negative seeds cross out: **0.2450 → 0.1843 on plate 7**,
  **0.1652 → 0.0953 on 13**, **0.1323 → 0.0386 on 1**, **0.1008 → 0.0677 on 3**, and
  **0.0681 → no area on 14**. The traced shares say what kind of outline `E` now has: plate 9
  goes 0.63 to 1.00 and 1.00, plate 15 0.81 to 1.00 and 1.00, plate 7 loses the 0.37 polygon
  and keeps two at 1.00. All but two of `E`'s polygons on these plates are now faces the
  drawing seals, bounded by the atlas's own ink.

  Thirty-eight other (plate, region) entries move beside `E` itself, all of them on the
  twelve plates and only four by more than 0.03 mm²: **`EPl` +0.2250** on plate 7 (the wedge
  `E` was holding in its face), **`OV` −0.0955** on plate 8, which is not a loss but the join
  — `OV` has no entry of its own there now and the app answers it with `E`'s outline, as it
  does on twelve other plates — **`3` +0.0669** on plate 14 (the other name printed in the
  face `E` withdraws from) and **`AOV` +0.0373** on 9. Then `IEn` +0.0248 on 15, `AOM`
  −0.0220 on 11, `GrO` +0.0187 on 7, `aca` +0.0165 on 15 and +0.0157 on 14, `aci` −0.0118 on
  6, −0.0075 on 7 and −0.0021 on 4, `IPl` −0.0107 on 1 and +0.0066 on 6, and twenty-four
  entries under 0.003 mm². Nothing off these twelve plates moves.

  Thirty-seven volumes move with them: `E` 0.4268 → 0.6999 mm³,
  `EPl` 6.8586 → 6.9768, `OV` 0.1131 → 0.0190 (3 → 1 components), `IPl` 0.7501 → 0.7279,
  `Gl` 6.1859 → 6.1658, `aci` 1.2898 → 1.2703 and the rest by less; `unnamed_fraction` goes
  0.0341 to **0.0339** and `regions_partition_the_volume` holds.

  `structure_plate_entries` goes 3,118 to **3,117** — `E` gains plate 11 and loses plate 14,
  `OV` loses plate 8 — the coloring stays 691 regions in 631 patches, polygons go 6,020 to
  **6,017**, points 168,847 to **168,855**, `faces_named_by_one_abbreviation` 3,529 to
  **3,539**, `seeds_moved_by_hand` 41 to **66**, `section_covered_mean` 0.9492 to **0.9495**,
  `entries_without_a_drawn_outline` stays 316, and **`boundary_edges_shared_exactly` stays
  1.0**. `label_inside_its_own_region` goes 0.9770 to **0.9746**, which is the fix rather
  than a cost: `E/OV` is printed outside the region it names on all fifteen plates, and four
  more of those labels exist now than did before.

  Five test literals move, and all five are counts of inputs this correction adds. In
  `tests/python/test_data.py` and `test_atlaslib.py` the located-label count goes 6,345 to
  **6,349** and the (plate, name) pairs 3,349 to **3,351**: the four `E/OV` boxes added to
  plate 11. In `tests/python/test_leaders.py` the tally of where the recorded tips land goes
  `191/12/37` to **`179/26/35`** and the `--odd` filter's 49 to **61**, and the list of
  superseded tips gains fourteen rows — `E` and `OV` on plates 7, 14 and 15 and both names
  once on 9 — beside `EPlA` on 5, 6 and 8, `VMHSh` on 30, `4N` and `4Sh` on 39 and `Sp5O` on
  51. That test's own docstring says to expect this: a `seed_overrides` row supersedes a tip
  without rewriting `label_leaders`, so a corrected tip is left visibly sitting in the
  neighbour it used to take ground from. `METHODS.md` takes `structure_plate_entries`,
  polygons and points through its markers; no rule in it changed.

  **Four of the twelve plates the reader marked are not fixed, and the reason is the same on
  all four: `MIN_FACE_PX`.** A face under 400 page px — 0.0198 mm² — is tracer noise as far
  as `build_region_extents` is concerned: `locate()` will not seed it, and `MIN_AREA_PX`
  would not publish a territory that size anyway. The ventricle the atlas draws is smaller
  than that from plate 12 back: **203 px on plate 12**, **211 and 259 px on 13**, **266 and
  258 px on 14**, and on **plate 1** the slit is drawn so fine that the tracing renders it as
  a chain of eight faces of 96 to 173 px apiece. So on plate 12 nothing at all is done — the
  `E/OV` tip already lands *inside* the 203 px lens, which is the one plate here where every
  input is already right and the floor is the whole of what is wrong. On 1, 13 and 14 the
  rows still go in, because the negative seeds are unambiguous and withdrawing the box is
  what honours them; what the positive seeds ask for cannot be given, so `E` ends plate 14
  with no area and plate 1 with its left slit only, and the right half of plate 13 keeps the
  0.0953 mm² the reader crosses out because the tip snaps back into the same 3,833 px face
  it came from. Plate 11's left spindle, at **389 px**, misses by eleven. This is a fault in
  the tool rather than in the atlas or in this branch's inputs, and it is not fixed here: the
  floor came down from 600 to 400 once already, for exactly this reason — the note on
  `MIN_AREA_PX` records the 51 sealed faces a single label seeded that were being dropped —
  and moving it again is its own pull request, made once against the whole series rather
  than once per correction in flight.

  The reading not taken, on all twelve, is the tracing. Two faces the atlas separates cut as
  one would put the word and the region in a single face, and adding the missing run would
  divide them — but every face `E` is given here is already sealed on all sides by drawn ink,
  which is what the traced shares of 1.00 say, and not one of the twelve files draws a
  boundary or an extent. Nor is any of them an island culled from `brain_outline`, which
  would leave `E` with no area rather than area in the wrong place, on eleven of the twelve.
  On plate 11 it would look like one, and is not: the section outline holds both spindles,
  and what was missing was the label. What would tell the two small-face plates apart from a
  tracing fault is the drawing at page resolution rather than the 1,100 × 703 plate image
  this session can read: on plate 1 the slit's chain is separated by four-point stubs 5 px
  long, and if those are the tracer's own specks rather than ink the atlas prints, removing
  them merges the chain into one face of about 1,000 px and the reader's two seeds would
  take it. At the resolution available here that cannot be shown either way, so no path was
  removed.
- **`MiA` gets the lamina round the accessory bulb on plates 5, 6 and 7.** The mitral cell
  layer of the accessory olfactory bulb is a band a tenth of a millimetre across, drawn on
  every one of these three plates between the core of the bulb and the layer outside it, and
  on each of them the extraction put `MiA` somewhere else — a different one of the four
  causes each time. Three corrections say so:
  `20260910T140024Z-p05-MiA`, `-p06-MiA` and `-p07-MiA`.

  **Plate 5 is the tracing.** The lamina's outer wall is a single stroke that starts at page
  (1555, 1192), runs the whole way round the accessory bulb and comes back past its own
  start at (1557.8, 1190.2) before carrying on outward into the next lamina, so the loop
  never closes; and because both ends of the **3.3 px (0.023 mm)** mouth belong to the same
  path, `BRIDGE_PX` — which joins a dangling end to *another* path — never joins them.
  Through that mouth the lamina and the layer outside it cut as one face, the
  **37,681 px (1.858 mm²)** face `GrO`, `MiA`, `dlo` and `lo` are each seeded in. `MiA`'s own
  printed leader ends inside the lamina, but its watershed share ran out through the mouth to
  the next drawn wall: **0.3995 mm²**, an annulus two laminae wide, which is what the
  correction's six negative seeds cross out. One run of tracing across the mouth — a `<path>`
  of one cubic in `outlines-solid`, carrying `data-correction` — closes it. The lamina is a
  sealed face of its own now, **2,833 px (0.140 mm²)** lettered by `MiA` alone, plate 5 going
  42 faces to 43; **`MiA` goes 0.3995 to 0.2021 mm²**, its traced shares 0.99, 1.00, 1.00 to
  **1.00, 1.00, 1.00**. No seed moves on plate 5: the printed leader tip was always in the
  right band, and the four positive seeds, which `inspect` reports change nothing unless a
  boundary moves, are not written.

  **Plate 6 is the seed.** The atlas prints `EPlA` and `MiA` one under the other *inside* the
  core of the left accessory bulb and draws neither of them a line, so the `MiA` box seeds
  the **7,282 px** core `EPlA` is printed in and `GlA`'s leader ends in, while the
  **5,391 px (0.266 mm²)** ring round it — which no printed word on the plate reaches — was
  held by the mirrors of the right-hand `GrA` (4,342 px) and `dlo` (1,047 px). One row of
  `seed_overrides` with `i = 0`, **0.51 mm** from the box, at the seed the reader put furthest
  into the ring, withdraws the box from the core and puts it in the ring; `MiA` takes the
  whole of a face the drawing seals and one name now letters, and plate 6 is left with no
  mirrored seed at all (2 → 0). **`MiA` goes 0.0243 to 0.3071 mm²** there, 0.0000 to
  **0.2828** on the left, and stops being an entry `w` marks as having no outline of its own.

  **Plate 7 is the label.** The atlas prints `MiA` twice on plate 7 and `label_positions`
  carries only the left-hand box, so the right-hand word — at the margin, **1.00 mm** from
  where its line ends — seeds nothing, and the **4,488 px (0.221 mm²)** band that line ends
  in was unassigned. One row with `i = −1`, a seed of its own beside the box that is right,
  at the end of the printed line where the reader put a seed. **`MiA` goes 0.1790 to
  0.4148 mm²**, the right hemisphere 0.0000 to **0.2358** at a traced share of **1.00**, the
  left crescent unchanged to the point.

  Over the series **`MiA` goes 1.144 to 1.465 mm² on the same five plates** (5 to 9) and
  **0.3759 to 0.6581 mm³ in two mesh components rather than four** — it was in pieces because
  on three of its five plates it was drawn on the wrong band or on no band at all. Twelve
  other entries move with it, all on these three plates and none off them. On **plate 5**: `GrO`
  +0.1963 — the layer between the lamina and the next drawn wall carries no printed name of
  its own on that hemisphere and belongs to the face `GrO` is printed in, so `GrO` takes what
  `MiA` gives up — `GrA` +0.0012 and `EPlA` −0.0002. On **plate 6**: `GrA` −0.2264 and `dlo`
  −0.0541, their mirrors handing the ring back to a printed name; `EPlA` **+0.0115**, which is
  the 223 px `MiA` used to hold inside the core and lose to `MIN_AREA_PX` — it was unassigned
  ground, and it is `EPlA`'s now; `GlA` −0.0006. On **plate 7** five entries move and **none
  by more than 0.0073 mm²** — `EPlA` −0.0073, `dlo` −0.0017, `GrA` −0.0005, `lo` −0.0004,
  `GrO` +0.0000 — each of them a share of the ink round the newly named band, which used to
  go whole to the neighbour because the band beside it had no name to split it with.

  Eleven volumes move: `MiA` 0.3759 to 0.6581 mm³ (4 → 2 components), `GrA` 1.1926 to 0.9951
  (3 → 4), `EPlA` 0.4894 to 0.4261, `GrO` 6.7788 to 6.8314, `dlo` 0.7658 to 0.7421, `GlA`
  1.0766 to 1.0608, `lo` 2.1784 to 2.1845, `aci` 1.2861 to 1.2898, `AOL` 0.5184 to 0.5201,
  and `EPl` and `FrA` by a ten-thousandth each; the label volume interpolates between plates,
  so a lamina that changes hands on 5, 6 and 7 redistributes voxels in the slabs either side.
  `unnamed_fraction` goes 0.0342 to **0.0341** and `regions_partition_the_volume` holds.
  `structure_plate_entries` stays 3,118 and the coloring 691 regions in 631 patches; polygons
  go 6,017 to **6,020**, points 168,801 to **168,847**, `faces_named_by_one_abbreviation`
  3,526 to **3,529**, `seeds_moved_by_hand` 39 to **41**, `section_covered_mean` 0.9490 to
  **0.9492**, `entries_without_a_drawn_outline` 317 to **316** — the rim `MiA` keeps on
  plate 6 is no longer all it has there — `label_inside_its_own_region` stays 0.9770, and
  **`boundary_edges_shared_exactly` stays 1.0**. `METHODS.md` takes the polygon and point
  counts and the `entries_without_a_drawn_outline` figure through its markers; no rule in it
  changed, and no test literal moves.

  **The readings taken, and the ones not.** On plate 5 the seed reading is ruled out by the
  seeds themselves: the reader's positives and negatives fall in the *same* face, so no
  placement of `MiA`'s seed separates them and the boundary has to move — which is what
  `inspect` says of every positive seed on that plate. On plate 6 the alternative is
  `i = −1`, which is what `corrections.py apply` writes for a seed carrying no `label_index`:
  the box would go on seeding the core and `MiA` would hold the ring *and* a rim of the core
  both, so the rows are written through `atlaslib.save_db` instead, in the layout `apply`
  writes, and `corrections/` is untouched. On plate 7 the alternative is the fuller form of
  the same cause — add the right-hand box to `label_positions` and point it with `i = 1` —
  and it is not taken because a *printed* box is mirrored: the mirror of that tip lands in the
  3,715 px band inside the left-hand `MiA`, a sealed face no printed word names, and `MiA`
  would gain **0.19 mm²** on a hemisphere this correction does not mark and which its own
  left-hand leader, followed correctly, does not point at. What would tell the two apart is a
  reading of that band — the left-hand `EPlA` on plate 7 is printed clear of the section with
  no line drawn, so nothing reaches it today — and reading a second box into `label_positions`
  wants the leader pass re-run against the PDF, which is a run of its own.

  **What is left open**, and it is the reader's own mark: the two negative seeds on the right
  of plate 6 are not satisfied, and `MiA` keeps the **0.0243 mm²** rim of the 4,602 px core it
  shares with `EPlA` there. On that hemisphere the drawing seals only one band outside the
  core, the 11,330 px face `GrA`'s own leader ends in with `aci`'s and `dlo`'s, and at the
  height of the two negatives the atlas prints one contour at the core's rim and the next 26
  page px out with nothing between them — the mirror of the left-hand ring *and* the band
  beyond it, undivided. Putting `MiA`'s right-hand tip in that face gives `MiA` the band along
  its medial axis and leaves `GrA` 0.0675 mm² of the 0.4843 it holds today, which is the same
  trade #126 made against `MiA` on this plate and no more supportable in this direction; the
  reader marked no positive seed there. So the right-hand tip is left where the atlas's own
  line ends, and what would settle it is a seed on that hemisphere or an ink boundary the
  drawing does not carry.

  One reading note on the report `corrections.py report` prints: its `— left hemisphere` and
  `— right hemisphere` rows prorate an entry's area over its polygons by |area|, so a region
  with a hole has the hole counted as area on the side it sits, and the side carrying it is
  overstated. `MiA` here is an annulus on plates 5 and 7, so the true split is left 0.3530 to
  **0.1556** and right 0.0465 unmoved on plate 5, and left 0.1790 unmoved and right 0.0000 to
  **0.2358** on plate 7, where the report's rows read 0.3774/0.0221 → 0.1875/0.0146 and
  0.1790/0.0000 → 0.0837/0.3311. The totals and every other row are right. The `inspect --qc`
  pictures fill a region one polygon at a time for the same reason, so a ring reads there as a
  filled disc with its hole drawn on top — on plates 5 and 7 the core inside `MiA` is
  `EPlA`'s. Nothing in `tools/` is touched here; a fix to `hemispheres()` and to that fill is
  its own pull request.
- **`EPlA` follows its own leader on plates 5, 6 and 8.** The atlas prints the external
  plexiform layer of the accessory olfactory bulb clear of the section on plates 5 and 6 and
  draws a line from the word down into the bulb; on plate 8 it prints the word *on* the band
  it names and draws no line at all. `label_leaders` read all three wrongly, and the region
  came out somewhere else on every one of them. On **plate 5** the march stopped **0.84 mm**
  short of the end of the printed line, where the line crosses the outer laminae, so `EPlA`
  seeded the **39,050 px (1.926 mm²)** face that `EPl`, `Gl`, `GlA` and `Mi` are each
  printed in, and the **4,319 px (0.213 mm²)** core the line really ends in was lettered by
  nothing. On **plate 6** it stopped **0.53 mm** short, at the wall of `GrO`, so `EPlA`
  seeded the 31,143 px granule layer of the main bulb on the right — and, mirrored about
  ML 0, took the 5,391 px ring round the accessory bulb on the left, a face no printed word
  names. On **plate 8** the mark the pass followed is not `EPlA`'s line at all: the atlas
  draws it none, and the march walked **0.50 mm** out along the `MiA` leader that runs past
  the word, so `EPlA` seeded the deep **3,194 px** band `GrA` is printed in while the
  **3,362 px** band the word sits on was left unnamed. Three corrections,
  `20260909T191540Z-p05-EPlA`, `-p06-EPlA` and `-p08-EPlA`, say the same thing on all three
  plates: positive seeds where the printed line ends, negative seeds crossing out the ground
  `EPlA` holds today.

  That is the seed in the wrong face, in the form where **the line was misread**, and the
  fix is one row of `seed_overrides` per misread box with `i` set — `i = 0` on plate 5,
  `i = 1` on 6 and on 8 — which withdraws the marched tip and puts the seed where the reader
  put it. The correction files carry no `label_index`, so `corrections.py apply` would have
  written them as `i = −1`, seeds of their own *beside* the tips, and `EPlA` would have kept
  the ground the negative seeds cross out; the rows are written through `atlaslib.save_db`
  instead, in the layout `apply` writes, and `corrections/` is untouched. Each row sits at
  the centre of the positive seeds the reader put in the face it names, except on plate 8,
  where the band is a U and the centre of the five falls outside it, so the row takes the
  seed in the trough.

  **`EPlA` goes 0.0648 to 0.2210 mm² on plate 5**, one polygon still but a whole sealed face
  now, its traced share 0.94 to **1.00**; **0.1980 to 0.3327 mm² on plate 8**, the right
  hemisphere 0.0417 to 0.1765 against the left's unmoved 0.1562, both shares **1.00**; and
  **0.2613 to 0.2942 mm² on plate 6**, where the right goes 0.0231 to 0.2095 and the left
  0.2382 to 0.0847, the ring the mirror had given it withdrawn. Over the series `EPlA` goes
  **0.953 to 1.277 mm² on the same five plates** and **0.2440 to 0.4894 mm³ in three mesh
  components rather than six** — the region was in pieces because on three of its five
  plates it was somewhere else.

  What it costs is on plate 6, and it is the one thing here worth a second reading.
  **`MiA` goes 0.2335 to 0.0243 mm²** there, its traced share 1.00 to 0.51: `MiA` held the
  whole of the 4,602 px inner face of the accessory bulb, `EPlA`'s corrected tip lands in
  that same face nearer its medial axis, and with no ink between them the watershed gives
  `EPlA` the core and `MiA` the rim. The atlas prints both words into one face the drawing
  seals, and nothing in the drawing divides them. **`GrA` goes 0.3282 to 0.4843 mm²** on the
  same plate: the left ring was `EPlA`'s only because the misread tip mirrored into it, and
  with the tip corrected the mirror of the right-hand `GrA` — whose own face is that ring's
  mirror — takes it, at traced shares 0.97 and 0.94. `GrO` goes 3.2149 to 3.2342 and `IPl`
  +0.0002. On plate 5 three entries move, `EPl` +0.0680 (the slab `EPlA` was holding in its
  face), `MiA` −0.0073 and `Mi` −0.0017; on plate 8 eight move and **none by more than
  0.0426 mm²** — `GrA` +0.0426, `GlA` −0.0039, `MiA` −0.0029, `dlo` −0.0006, `GrO` +0.0004,
  `EPl` −0.0002, `Gl` and `ON` +0.0001. Nothing off plates 5, 6 and 8 moves.

  Fourteen volumes move with them: `EPlA` 0.2440 to 0.4894 mm³ (6 → 3 components), `GrA`
  1.1304 to 1.1926 (4 → 3), `MiA` 0.4224 to 0.3759, `EPl` 6.8211 to 6.8589, `GrO` 6.8000 to
  6.7788, `GlA` 1.0935 to 1.0766, and `dlo`, `aci`, `FrA`, `ON`, `lo`, `AOE`, `Mi` and `Gl`
  by less; `unnamed_fraction` goes 0.0344 to **0.0342** and `regions_partition_the_volume`
  holds. `structure_plate_entries` stays 3,118 and the coloring 691 regions in 631 patches;
  polygons go 6,015 to 6,017, points 168,790 to 168,801, `faces_named_by_one_abbreviation`
  3,523 to 3,526, `seeds_moved_by_hand` 36 to 39, `section_covered_mean` 0.9485 to 0.9490,
  `entries_without_a_drawn_outline` 316 to 317 — the rim `MiA` keeps on plate 6 is half
  watershed — and **`boundary_edges_shared_exactly` stays 1.0**.

  Two literals move, both of them counts of *this* kind of fix and both in
  `tests/python/test_leaders.py`. The tips it tallies come from `label_leaders`, which a
  `seed_overrides` row supersedes without rewriting, so a corrected tip is left visibly
  sitting in the neighbour it used to take ground from — which is what the test's own
  docstring says to expect. `194/9/37` becomes **`191/12/37`**, the `--odd` filter's 46
  becomes **49**, and the list of superseded tips gains `(5, 'EPlA')`, `(6, 'EPlA')` and
  `(8, 'EPlA')` beside `VMHSh` on 30, `4N` and `4Sh` on 39 and `Sp5O` on 51.
  `label_inside_its_own_region` goes 0.9775 to **0.9770** for the same reason and no other:
  it reads the recorded tip where a label has one, and these three are exactly the three
  labels that flip. `METHODS.md` takes the polygon and point counts and the
  `entries_without_a_drawn_outline` figure through its markers; no rule in it changed.

  The reading not taken, on all three plates, is the tracing. Two faces the atlas separates
  cut as one would put the word and the region in a single face, and adding the missing run
  would divide them — but every face at issue here is already sealed by drawn ink on all
  sides, which is what the traced shares of 1.00 on plates 5 and 8 say, and none of the three
  corrections draws a boundary or an extent. Nor is it an island culled from `brain_outline`,
  which would leave `EPlA` with no area at all rather than area in the wrong place, or a
  label never read: `label_positions` carries every `EPlA` box on all three plates. Within
  the seed reading, the alternative is `i = −1` beside the tips; the negative seeds are what
  rule it out. What would settle plate 6 the other way is the one open question here, and it
  is the reader's own: the file's note says **"GlA seems to be erroneously pointing to EPlA
  in left hemisphere of plate 6"**, and it is right — the printed `GlA` leader on that
  hemisphere, followed correctly, ends inside the 7,282 px core that `EPlA` and `MiA` are
  both printed in, and `GlA` holds 0.2724 mm² of it. Four of the reader's positive seeds are
  in that share and are still `GlA` after this fix. Moving `GlA` needs a reading of which
  band the accessory glomerular layer is on plate 6, which neither the drawing nor these
  three files supplies — the atlas prints `GlA` once on the plate, on the left, and draws no
  other line for it — so it is left for a correction of its own, on `GlA`.
- **`EPlA` follows its own leader on plates 5, 6 and 8.** The atlas prints the external
  plexiform layer of the accessory olfactory bulb clear of the section on plates 5 and 6 and
  draws a line from the word down into the bulb; on plate 8 it prints the word *on* the band
  it names and draws no line at all. `label_leaders` read all three wrongly, and the region
  came out somewhere else on every one of them. On **plate 5** the march stopped **0.84 mm**
  short of the end of the printed line, where the line crosses the outer laminae, so `EPlA`
  seeded the **39,050 px (1.926 mm²)** face that `EPl`, `Gl`, `GlA` and `Mi` are each
  printed in, and the **4,319 px (0.213 mm²)** core the line really ends in was lettered by
  nothing. On **plate 6** it stopped **0.53 mm** short, at the wall of `GrO`, so `EPlA`
  seeded the 31,143 px granule layer of the main bulb on the right — and, mirrored about
  ML 0, took the 5,391 px ring round the accessory bulb on the left, a face no printed word
  names. On **plate 8** the mark the pass followed is not `EPlA`'s line at all: the atlas
  draws it none, and the march walked **0.50 mm** out along the `MiA` leader that runs past
  the word, so `EPlA` seeded the deep **3,194 px** band `GrA` is printed in while the
  **3,362 px** band the word sits on was left unnamed. Three corrections,
  `20260909T191540Z-p05-EPlA`, `-p06-EPlA` and `-p08-EPlA`, say the same thing on all three
  plates: positive seeds where the printed line ends, negative seeds crossing out the ground
  `EPlA` holds today.

  That is the seed in the wrong face, in the form where **the line was misread**, and the
  fix is one row of `seed_overrides` per misread box with `i` set — `i = 0` on plate 5,
  `i = 1` on 6 and on 8 — which withdraws the marched tip and puts the seed where the reader
  put it. The correction files carry no `label_index`, so `corrections.py apply` would have
  written them as `i = −1`, seeds of their own *beside* the tips, and `EPlA` would have kept
  the ground the negative seeds cross out; the rows are written through `atlaslib.save_db`
  instead, in the layout `apply` writes, and `corrections/` is untouched. Each row sits at
  the centre of the positive seeds the reader put in the face it names, except on plate 8,
  where the band is a U and the centre of the five falls outside it, so the row takes the
  seed in the trough.

  **`EPlA` goes 0.0648 to 0.2210 mm² on plate 5**, one polygon still but a whole sealed face
  now, its traced share 0.94 to **1.00**; **0.1980 to 0.3327 mm² on plate 8**, the right
  hemisphere 0.0417 to 0.1765 against the left's unmoved 0.1562, both shares **1.00**; and
  **0.2613 to 0.2942 mm² on plate 6**, where the right goes 0.0231 to 0.2095 and the left
  0.2382 to 0.0847, the ring the mirror had given it withdrawn. Over the series `EPlA` goes
  **0.953 to 1.277 mm² on the same five plates** and **0.2440 to 0.4894 mm³ in three mesh
  components rather than six** — the region was in pieces because on three of its five
  plates it was somewhere else.

  What it costs is on plate 6, and it is the one thing here worth a second reading.
  **`MiA` goes 0.2335 to 0.0243 mm²** there, its traced share 1.00 to 0.51: `MiA` held the
  whole of the 4,602 px inner face of the accessory bulb, `EPlA`'s corrected tip lands in
  that same face nearer its medial axis, and with no ink between them the watershed gives
  `EPlA` the core and `MiA` the rim. The atlas prints both words into one face the drawing
  seals, and nothing in the drawing divides them. **`GrA` goes 0.3282 to 0.4843 mm²** on the
  same plate: the left ring was `EPlA`'s only because the misread tip mirrored into it, and
  with the tip corrected the mirror of the right-hand `GrA` — whose own face is that ring's
  mirror — takes it, at traced shares 0.97 and 0.94. `GrO` goes 3.2149 to 3.2342 and `IPl`
  +0.0002. On plate 5 three entries move, `EPl` +0.0680 (the slab `EPlA` was holding in its
  face), `MiA` −0.0073 and `Mi` −0.0017; on plate 8 eight move and **none by more than
  0.0426 mm²** — `GrA` +0.0426, `GlA` −0.0039, `MiA` −0.0029, `dlo` −0.0006, `GrO` +0.0004,
  `EPl` −0.0002, `Gl` and `ON` +0.0001. Nothing off plates 5, 6 and 8 moves.

  Fourteen volumes move with them: `EPlA` 0.2440 to 0.4894 mm³ (6 → 3 components), `GrA`
  1.1304 to 1.1926 (4 → 3), `MiA` 0.4224 to 0.3759, `EPl` 6.8211 to 6.8589, `GrO` 6.8000 to
  6.7788, `GlA` 1.0935 to 1.0766, and `dlo`, `aci`, `FrA`, `ON`, `lo`, `AOE`, `Mi` and `Gl`
  by less; `unnamed_fraction` goes 0.0344 to **0.0342** and `regions_partition_the_volume`
  holds. `structure_plate_entries` stays 3,118 and the coloring 691 regions in 631 patches;
  polygons go 6,015 to 6,017, points 168,790 to 168,801, `faces_named_by_one_abbreviation`
  3,523 to 3,526, `seeds_moved_by_hand` 36 to 39, `section_covered_mean` 0.9485 to 0.9490,
  `entries_without_a_drawn_outline` 316 to 317 — the rim `MiA` keeps on plate 6 is half
  watershed — and **`boundary_edges_shared_exactly` stays 1.0**.

  Two literals move, both of them counts of *this* kind of fix and both in
  `tests/python/test_leaders.py`. The tips it tallies come from `label_leaders`, which a
  `seed_overrides` row supersedes without rewriting, so a corrected tip is left visibly
  sitting in the neighbour it used to take ground from — which is what the test's own
  docstring says to expect. `194/9/37` becomes **`191/12/37`**, the `--odd` filter's 46
  becomes **49**, and the list of superseded tips gains `(5, 'EPlA')`, `(6, 'EPlA')` and
  `(8, 'EPlA')` beside `VMHSh` on 30, `4N` and `4Sh` on 39 and `Sp5O` on 51.
  `label_inside_its_own_region` goes 0.9775 to **0.9770** for the same reason and no other:
  it reads the recorded tip where a label has one, and these three are exactly the three
  labels that flip. `METHODS.md` takes the polygon and point counts and the
  `entries_without_a_drawn_outline` figure through its markers; no rule in it changed.

  The reading not taken, on all three plates, is the tracing. Two faces the atlas separates
  cut as one would put the word and the region in a single face, and adding the missing run
  would divide them — but every face at issue here is already sealed by drawn ink on all
  sides, which is what the traced shares of 1.00 on plates 5 and 8 say, and none of the three
  corrections draws a boundary or an extent. Nor is it an island culled from `brain_outline`,
  which would leave `EPlA` with no area at all rather than area in the wrong place, or a
  label never read: `label_positions` carries every `EPlA` box on all three plates. Within
  the seed reading, the alternative is `i = −1` beside the tips; the negative seeds are what
  rule it out. What would settle plate 6 the other way is the one open question here, and it
  is the reader's own: the file's note says **"GlA seems to be erroneously pointing to EPlA
  in left hemisphere of plate 6"**, and it is right — the printed `GlA` leader on that
  hemisphere, followed correctly, ends inside the 7,282 px core that `EPlA` and `MiA` are
  both printed in, and `GlA` holds 0.2724 mm² of it. Four of the reader's positive seeds are
  in that share and are still `GlA` after this fix. Moving `GlA` needs a reading of which
  band the accessory glomerular layer is on plate 6, which neither the drawing nor these
  three files supplies — the atlas prints `GlA` once on the plate, on the left, and draws no
  other line for it — so it is left for a correction of its own, on `GlA`.
- **A correction's session opens its own pull request again.** #114 moved that from the
  session to the workflow, which opens it from `build/pr.md` with the workflow's own
  token -- and that token may open a pull request only where the repository allows
  GitHub Actions to create and approve them, which this one does not. So the first three
  corrections sent together (`EPlA` on plates 5, 6 and 8, run #27) were applied, pushed
  and left with no pull request to read them in, an hour's run ending red one step from
  the end; #126 is that pull request, opened by hand. The session opens it itself now,
  with the App token the action hands it, as it did for #109 and #110; the workflow's
  step finds the one it opened and waits on the checks, and still opens one from the file
  where the session could not, saying which setting it wants when it cannot either.
- **The footer told every reader the build was `{{BUILD_HASH}}`.** The site's footer read
  *Build `{{BUILD_HASH}}` · Updated {{BUILD_DATE}} {{BUILD_TIME}}*, About said the same, and
  the commit beside both linked `/commit/{{BUILD_HASH}}`, which is not a commit. The tokens
  themselves are deliberate and stay: since #114 the committed pages keep them, because a
  stamp in them was three files that conflicted between any two branches whatever else they
  changed, and `.github/workflows/pages.yml` stamps the copy it deploys instead. What that
  arrangement rests on is the deploy, and there has never been one -- `pages.yml` fired only
  on `workflow_dispatch` and on a `v*` tag, and it has run **zero** times. Pages is still
  serving main's root, which is the committed pages, so what every reader has been handed
  since is the page with nothing filled in.

  Two things now stand between a reader and a token. `pages.yml` runs on each push to `main`
  and builds the site stamped with the commit it deploys, so once **Settings -> Pages ->
  Source** is *GitHub Actions* the served page names its own commit; until then the deploy
  job reads that setting (`build_type`) and skips rather than turning main red on every push,
  and the build job leaves a notice saying which source Pages is on. And the page no longer
  takes its own stamp on faith: `BUILD` is empty unless the `gae-build` meta holds something
  commit-shaped -- the test `src/fixer.js` already made of the same meta -- and a page nothing
  stamped drops the claim from the footer and from About rather than printing it. Both claims
  are wrapped in one `.fbuild` span for that, which `unstamp` in `tools/build_app.py` reads
  through unchanged.

  The token was not only on screen: `BUILD` was the meta's text, which is truthy, so the
  `BUILD || 'unstamped'` and `BUILD || null` the four take-aways were written with never fired.
  **Every drawing-error and feature report filed from the site named `{{BUILD_HASH}}
  {{BUILD_DATE}}` as its build**, as did every exported `gerbil_atlas_notes.json` and every
  targeting plan saved as text or JSON. They now say `unstamped`, or carry `null`, on a page
  that has no build to name. `tests/js/smoke.spec.js` serves a browser the committed page's
  tokens back and asserts no build is named anywhere in it; `tests/python/test_atlaslib.py`
  holds the two spans and counts every token in a render, which is also what keeps a token
  from being written literally into `src/app.js`, where the build would fill it in.

- **`E` gets both ependymal slits on plate 16, and gives back the wedge of accumbens it was
  standing in.** The atlas letters the olfactory ventricle on this plate as the compound
  `E/OV`, once on each hemisphere, and sets it *across* the slit it names rather than in it:
  `E` on the lateral side of the lens, `OV` on the medial, and the lens itself is 0.20 mm
  wide. So neither `E` box centre falls inside the thing the word points at. The left one
  lands 0.19 mm away, at ML −1.03 DV −6.14, inside the **16,354 px** block that `3`, `AcbSh`
  and `IEn` are each printed in, and the watershed cut `E` a **914 px** wedge out of the
  accumbens shell. The right one lands on the ink of the slit's own lateral wall, 0.08 mm
  out; `locate()` snapped it to the **12,114 px** face `AcbSh`, `Tu` and `VP` share, but the
  5 × 5 mark a seed on a wall is placed with sits on the wall, which is in no face at all, so
  it was masked out of the watershed and **`E` had no area whatever on the right of plate
  16** — on a hemisphere the plate letters. The two slits themselves, **843 px** on the left
  and **664 px** on the right, were faces of their own, sealed end to end by ink the atlas
  drew, and lettered by nothing.

  That is the seed in the wrong face in its first form — **the box is wrong** — and
  `20260909T164235Z-p16-E` says so twice over: a positive seed in each slit, and two negative
  seeds inside the wedge, the reader crossing out ground `E` holds today. So the fix is two
  rows of `seed_overrides` with `i` set, `i = 0` for the right box and `i = 1` for the left,
  which withdraw the printed boxes' own seeds and put each where the reader put it. The
  correction file carries no `label_index`, so `corrections.py apply` would have written the
  rows as `i = −1` — seeds of their own, beside the boxes — and `E` would have kept the wedge
  as well; they are written through `atlaslib.save_db` instead, in the layout `apply` writes,
  and `corrections/` is untouched. These are the first rows here to stand in for a printed
  box on the word of a correction rather than a report.

  **`E` on plate 16 goes 0.0447 to 0.0828 mm², one polygon to two**, one per hemisphere where
  it had none on the right, and **its traced share goes 0.665 to 1.00 and 1.00** — the
  boundary it stops at is now ink the atlas printed, every pixel of it, where two thirds of
  the old wedge's border was a watershed drawn through the accumbens. Of the **1,676 px** `E`
  now holds, **1,511 were unassigned ground**, the two faces nothing lettered; 39 were already
  `E` where the old wedge touched the slit, and the remaining 126 are the walls themselves,
  ink the neighbours now divide with a region that has a name. **`AcbSh` goes 0.8757 to
  0.9168 mm²**, which is 874 of the wedge's 914 px coming back to the shell they were cut
  from. Nine other entries on the plate move and **none by more than 0.0017 mm²** — `OV`
  −0.0017, `fmi` −0.0011, `AcbC` −0.0010, `DP` +0.0004, `3` +0.0003, `LO` +0.0002, `VO`
  +0.0001, `AI` −0.0001, `aca` ±0.0000 — those 126 px of wall between them. Unassigned space
  on plate 16 goes 1.0956 to 1.0189 mm² in 18 polygons rather than 20, and the two that go
  are the slits.

  Eleven (plate, region) entries move in the whole-atlas re-cut and every one is on plate 16.
  `structure_plate_entries` stays 3,118 and the coloring 691 regions in 631 patches; polygons
  go 6,013 to 6,014, points 168,751 to 168,781, `seeds_moved_by_hand` 32 to 34, faces named
  by one abbreviation 3,519 to 3,521, labels relocated 188 to 187 — the right box no longer
  needs snapping — `traced_fraction_ge_90` 0.804 to 0.805, and
  **`boundary_edges_shared_exactly` stays 1.0**. `label_inside_its_own_region` goes 0.9776 to
  0.9775, which is the fix and not a cost: both `E` boxes are printed outside the region they
  name, which is the whole of what was wrong here. Over the series `E` goes 1.542 to 1.580
  mm² and 0.4141 to 0.4268 mm³ in 18 mesh components rather than 17. Twenty-one structures'
  volumes move, `AcbSh` 2.1476 to 2.1594 and `AcbC` 3.0183 to 3.0120 mm³ the largest of them;
  `unnamed_fraction` stays 0.0346 and the brain volume 1046.607 mm³. `E`'s *mesh* volume
  falls, 0.3871 to 0.3162 mm³ with `coarsening_rel_error` 0.0 to 0.2068 and the atlas's
  triangles 1,591,116 to 1,582,008: the published mesh is a coarsening at 0.15 mm, and what
  `E` gained is a sheet 0.20 mm across, which that sampling cannot hold. The voxel volume,
  which the tables and the 3-D readout quote, is the one that rises.

  The reading not taken is the tracing. Two faces the atlas separates being cut as one would
  put the slit and the wedge in a single face, and adding the missing run would divide them —
  but the slits are already faces, sealed by drawn ink on all sides, which is what the traced
  share of 1.00 either side says, and the correction draws no boundary and no extent. Nor is
  it an island culled from `brain_outline`, which would leave the region with no area at all
  on either hemisphere, or a label never read: the plate's `label_positions` carries both `E`
  boxes. Within the seed reading, the alternative to withdrawing the boxes is `i = −1` beside
  them, which is what plate 3 and plate 28 took; `E` would then come out 0.127 mm² here, the
  two slits **and** the wedge. The two negative seeds are what rule it out, and what would
  settle it without them is whether the atlas means `E` to name any part of the accumbens
  block — it does not: that block is lettered `3`, `AcbSh` and `IEn`, all three printed
  inside it, and `E` is printed on the slit's wall. `OV`'s own box, medial of the same slit,
  is left alone: it seeds the face it is printed in and comes out 0.0401 to 0.0384 mm²,
  losing 28 px of the shared wall. Whether the compound `E/OV` means the slit is `E`'s lining
  around `OV`'s lumen, and so should be split rather than given whole to `E`, is a question
  the drawing does not answer — the atlas draws one lens and prints two names beside it —
  and it is the same reading plate 3 took in #110.
- **The right `RAPir` on plate 28 gets its column too.** #109 gave the rostral
  amygdalopiriform area the whole column the atlas draws it as, on the left of plate 28,
  where the correction was drawn -- and said the right was drawn the same way and untouched:
  the word `RAPir` on the band between two laminar lines, the **7,982 px** face deep to it
  and the **4,561 px** face between it and the pia lettered by nothing, `RAPir` 0.5641 mm²
  on the left against 0.0910 on the right. Reported against the published site as still not
  fixed, which on the right it was not. Two rows of `seed_overrides`, one in each unlettered
  face at the points #109 named for them, written from `corrections/report-p28-RAPir-right.json`
  -- a file written by hand from the report, not by the plate view, which is what its
  `source` says. **`RAPir` on plate 28 goes 0.6551 to 1.2916 mm²**, the right hemisphere
  0.0910 to 0.7275, the left as #109 left it; over the series 1.718 to 2.355 mm² and 0.5711
  to 0.7763 mm³, in two mesh components rather than three, the right no longer a band and a
  scrap. The new ring is drawn ink for 98.5% of its length. A third polygon arrives with it:
  a three-pixel island on the lower laminar line beside the letter R, 0.0001 mm², where the
  ink loops and the watershed leaves a hole -- not a boundary anyone can see, and noted
  rather than culled, since the floor is on faces and this is not one.

  Eight other entries on plate 28 move, none by more than 0.0045 mm² -- `3`, `BMP`, `1`,
  `VEn`, `Pir`, `2`, `LHb`, `sm` -- the ink those faces now divide with a named neighbour;
  nothing off the plate does. `unnamed_fraction` goes 0.0346 to 0.0344, sixteen volumes move
  and `region_triangles` with them. `structure_plate_entries` stays 3,118, polygons go 6,013
  to 6,014, points 168,751 to 168,760, `seeds_moved_by_hand` 32 to 34, and
  **`boundary_edges_shared_exactly` stays 1.0**. Every `--check` is clean, 64 Python tests
  and 109 browser tests pass; the pictures are `qc/chk_corr_report-p28-RAPir-right_site.png`
  and the whole plate beside it. The rows say where they came from; the block note is
  static now and enumerates nothing.

- **`E` on plate 3 gets the run of ventricle above the pinch.** The atlas draws the
  ependyma of the olfactory ventricle on the right of plate 3 as one contour, from below the
  `aci` circle down to its ventral bulb, and pinches it to a single stroke halfway along, at
  DV −5.44 to −5.66, where its two walls meet. So the extraction cuts the slit into two
  faces, and the one line the `E/OV` label draws ends in the lower of them: 163 px of black
  ink a reader followed by hand into `TIP_HAND`, no fragment of it surviving the
  straightness test. The face above the pinch — 555 px of the same slit, running up to
  DV −4.93 — was lettered by nothing, and it is where the first seed of correction
  `20260908T012002Z-p03-E` lands. `inspect` put that seed in an unnamed face and the
  region's own box in the face it already letters, which is the seed-in-the-wrong-face
  reading in its second form: **the box is right and a face is simply unlettered**.

  Three rows of `seed_overrides`, seeds of their own, from the correction: one in the face
  above the pinch, two on the spindle the label's line already ends in. **`E` on plate 3
  goes 0.0669 to 0.1008 mm², two polygons to three**, the right hemisphere 0.0356 to 0.0696
  against the left's unchanged 0.0313, and every polygon's traced share is 1.00 before and
  after — the outline it stops at is one the atlas printed, every pixel of it. Over the
  series `E` goes 1.508 to 1.542 mm² and 0.4038 to 0.4141 mm³, in the same 17 mesh
  components, and its centre moves DV −6.01 to −5.96.

  The reader marked a fourth point, on the ink of the pinch itself, and that one is not
  written. A seed there is snapped into the granule face `GrA` and `GrO` share: `E` comes
  out 0.1226 mm² with **27% of the new polygon's border on no ink at all**, a watershed
  drawn through the granule layer, which is not a boundary to show anyone. What the three
  rows do cost the neighbours is their share of the ink along the walls of the run —
  **`GrA` 1.1383 to 1.1356 mm² and `GrO` 0.4559 to 0.4543**, 66 and 20 page px of boundary
  and no interior between them. Of the 698 px `E` gains, 555 were unassigned ground.

  Three (plate, region) entries move in the whole-atlas re-cut, all on plate 3.
  `boundary_edges_shared_exactly` stays 1.0, `structure_plate_entries` stays 3,118, the
  coloring is unchanged at 691 regions, polygons go 6,012 to 6,013, points 168,740 to
  168,751 and `seeds_moved_by_hand` 29 to 32 — counted from the base the `RAPir` entry
  below leaves, the two corrections riding one branch and that one landing first. Three
  more olfactory-bulb structures move in the volume with their areas untouched — `IPl`
  +0.0052, `aci` +0.0017, `EPl` +0.0005 mm³, and `GrA` +0.0021 though its area falls — the
  label volume being interpolated between plates, so a boundary that moves on 3
  redistributes voxels in the slabs either side. METHODS takes the polygon and point
  counts, 6,013 over 168,751, which are the two corrections' together.

  The correction says the region "should better mirror the left hemisphere", and there is a
  second reading of that this does not take. The ventral spindle is drawn with a hairline
  down its length — the lumen, collapsed to a stroke — and the two hemispheres put their
  label's tip on opposite sides of it. Mirrored about the section's own axis of symmetry
  (page x 1665, IoU 0.913), the left `E` lands 71% inside the face that is unlettered on the
  right, and the right `E` is the exact mirror of the strip that is unlettered on the left.
  Read that way the fix would be a `label_index` row moving the right box off the medial
  strip into the lateral one, and `E` would stay near 0.03 mm² a side. It is not taken: it
  leaves all four of the reader's positive seeds outside `E` and withdraws ground two of
  them stand on, and that tip is no misread — it is the end of the label's own black ink,
  followed by hand and recorded in `TIP_HAND` with the account of the page. What would
  settle it is the printed page at the bulb: whether that hairline is the ventricle's lumen,
  in which case the ependyma is the whole spindle either side of it and both hemispheres are
  short, or a wall between two compartments of which the label names one.
- **The rostral amygdalopiriform area gets the whole column the atlas draws it as, on the
  left of plate 28.** `RAPir` is printed once on that hemisphere and the plate sets the word
  on the thin band between two laminar lines, so the extraction was as generous as the plate
  is lettered and no more: the word seeded the **899 px** band it sits in, and the **6,853
  px** face deep to it and the **3,140 px** face between it and the pia -- the rest of the
  same cortical column, standing between the same two areal borders, the dotted one against
  `Pir` and the one against `PLCo` -- went unnamed, nothing the plate prints lettering
  either. The layers of `Pir` and `PLCo` on both sides of them carry a digit apiece;
  `RAPir`'s do not, and one printed word can seed one face. So the region came out as
  **0.0522 mm² of band inside the 0.5641 the drawing encloses**, which is what the reader
  who drew `corrections/20260908T142315Z-p28-RAPir.json` marked, a seed to each of the three
  faces.

  Three rows of `seed_overrides` with `i = -1`, one per seed, written by `corrections.py
  apply`; the third lands in the face the printed word already seeds and changes nothing.
  **`RAPir` on plate 28 goes 0.1432 to 0.6551 mm²**, its left hemisphere 0.0522 to 0.5641
  against the right's 0.0910, and over the series the structure goes 1.206 to 1.718 mm² and
  0.4246 to 0.5711 mm³, its centre moving ML −4.88 to −4.75, DV −8.07 to −8.19 and AP −2.24
  to −1.98 as plate 28, its rostral end, stops being a scrap. The new outline is ink the
  atlas drew for **99.6%** of its length: nine page pixels of it fall off the tracing,
  single pixels where the simplified ring cuts a corner, and the traced share reads 0.996
  where the band alone read 1.000.

  That the column is one region and not three is what the drawing says on the plates either
  side. On plate 30 `RAPir` is a single undivided face of 9,267 px running from the pia to
  `BLP` and `BMP`, and on the right of plate 29 the word falls in the deep part of the
  column and takes 4,036 px of it -- the same anatomy the left of 29 letters as a 1,281 px
  band, for no reason but where the word is set. **Eight other entries on plate 28 move and
  every one by 0.0036 mm² or less** -- `3` −0.0036, `BMP` −0.0034, `1` −0.0013, `PLCo`
  −0.0008, `Pir` −0.0004, `VEn` −0.0002, `sm` −0.0001, `LHb` +0.0001 -- which is the
  watershed's share of the ink those faces now divide with a neighbour that has a name.
  Half a square millimetre of what `RAPir` gains was holding no name at all: in three
  dimensions `unnamed_fraction` goes 0.0348 to **0.0346**, and thirteen structures' volumes
  move, `1` coming out in six mesh components rather than seven and the other eleven in the
  fourth decimal. `structure_plate_entries` stays 3,118, polygons 6,012 and the coloring 691
  regions in 631 patches; points go 168,729 to 168,740, faces named by one abbreviation
  3,516 to 3,518, seeds moved by hand 26 to 29, `section_covered_mean` 0.9483 to 0.9484,
  `label_inside_its_own_region` 0.9776 either way, and **`boundary_edges_shared_exactly`
  stays 1.0**. 64 Python tests and 109 browser tests pass, and `--check` on the tables,
  groups, colors, face maps and pages is clean.
- **The site picture is drawn round the reader's marks, not round every box of the name.**
  `qc/chk_corr_<id>_site.png` took its window from everything of the region's name on the
  plate -- its polygons either side and the boxes it is printed in -- and a name the atlas
  prints on both hemispheres, as `RAPir` is on plate 28, has a box and an area on the far
  side too, so the window was the whole plate and the region a green wedge in the corner of
  it. The window is now the reader's marks (seeds, boundaries, extents) and only those
  polygons and boxes that lie within a quarter of the marks' spread, or `SITE_MIN_PX` / 2,
  of them; a correction with no marks takes everything of the name as before. On plate 28
  the two panels now show the column and its neighbours at a third of the plate's width.
  Checked: `tests/python/test_corrections.py` 8 passed, and the picture on the branches of
  #109 and #110 is the one their pull requests open with.

- **A correction's run ends green when its pull request does.** The last step of
  `.github/workflows/apply-correction.yml` waited on CI with `gh pr checks --watch
  --fail-level error`, and `--fail-level` is a flag of nothing: `gh` printed its usage and
  exited 1, so **the first two runs to carry a correction the whole way -- `RAPir` on plate
  28 (#109) and `E` on plate 3 (#110), fixes pushed, pull requests opened, CI green on
  both -- were reported as failures** ninety seconds after the pull request was named.
  The flag is `--fail-fast` now, which with `--watch` holds until every check on the head
  has finished or the first has failed, exiting 0 for green and 1 otherwise; those are the
  two flags the runner's own usage lists for this. Checked: the file parses, the block
  passes `bash -n`, and the flag list is read off what `gh` printed in both runs.

- **The `1` printed on plate 16 was the `LO` beside it, read twice.** Layer 1 of cortex had
  a located label on plate 16 at ML +1.96, DV −5.66 and no region anywhere on the plate — the
  only plate between 11 and 33 where it carries a box and gets no ring, and every plate from
  17 on gives it one ring per box. The box was not a `1`. It sits on the printed word `LO`,
  0.0020 of the frame from `LO`'s own box in x and 0.0008 in y, which is inside a single
  glyph: the label pass read the right-hemisphere `LO` a second time as a `1`. Plate 16 is
  the only plate in the atlas where the `1` box overlaps another structure's box at all, so
  this is one misread word rather than a rule that needs changing. The layer-1 digits the
  plate really does print — beside `Pir`, `DTT` and `Tu` — were never located, and still are
  not; that is the ordinary shortfall the label pass has on the small digits, not this.

  What the phantom cost was a seed. It claimed a face between `LO` and `VO`, the face came
  out under the publication floor and was culled, and the ground it had taken stayed
  unassigned — a white notch beside `LO` in the QC render, with a `1` printed on `LO`'s own
  word and nothing to hover. Removing the box gives that ground back to the regions the atlas
  draws around it: on plate 16 **`LO` goes 0.8558 to 0.8590 mm², `VO` 1.3842 to 1.3866,
  `AcbSh` 0.8746 to 0.8757 and `aca` 0.3052 to 0.3041** — four entries on one plate, and the
  whole-atlas re-cut changes no others. Seeds on the plate go 68 to 67 and the region count
  stays 34.

  Over the atlas the located-label count goes **6346 to 6345** and the count of (plate, name)
  pairs **3350 to 3349** — `1` no longer has a box on plate 16, and plate 16 joins 11 through
  15 as a plate where the index lists layer 1 and no copy of the word was read. Three test
  literals move with them, in `test_label_positions` and in `test_atlaslib`'s label-table
  row count. `faces_named_by_one_abbreviation` rises 3515 to 3516, since the face by `LO` is
  now claimed by one name instead of contested, and `boundary_edges_shared_exactly` stays 1.0.

- **A correction reaches its session on an installer that left no binary behind.**
  `anthropics/claude-code-action` installs Claude Code itself -- `curl -fsSL
  https://claude.ai/install.sh | bash -s -- <version>`, the version a constant bumped with
  each release of the action -- and then hands the SDK `~/.local/bin/claude` on the strength
  of the installer's exit code alone. The installer that 2.1.265 brought (v1.0.218 of the
  action, which `v1` moved to on the evening of 2026-09-08) printed "claude command at
  ~/.local/bin/claude missing or broken (~/.local/bin does not exist)", then its success
  banner, and exited 0, where 2.1.263 that morning had placed the launcher. So **both
  dispatches made after the tag moved -- `E` on plate 3 and `RAPir` on plate 28 -- died at
  the SDK with `Claude Code native binary not found` before a prompt was read**, ninety
  seconds in and with nothing on either branch.

  The install is a step of `.github/workflows/apply-correction.yml` now, at the version the
  action itself pinned when a run last went the distance, and it is moved by hand once the
  action's pin has moved and a run on it has reached the session. The step makes
  `~/.local/bin` first, which the 2.1.265 installer no longer does for itself; falls back to
  the binary at its versioned path under `~/.local/share/claude/versions/` where an installer
  downloaded it and failed only to place the launcher over it; and fails in its own name,
  saying what it looked for, where it finds neither. The path is given to the action as
  `path_to_claude_code_executable`, which is what skips the action's own install. Checked:
  the file parses and the step passes `bash -n`; the block was run under the shell Actions
  uses (`-e -o pipefail`) against a stand-in installer that placed the launcher, placed only
  the versioned binary, placed nothing, and exited non-zero -- the first two hand the action a
  path that answers `--version`, the third stops on the `::error::`, and the fourth stops on
  the installer's own exit code. The first draft of the block lost the third case to
  `pipefail`: `find` over a directory that is not there failed the assignment before the
  message was reached, and the step exited 1 with nothing said.


- **A correction is merged with a credential that is still alive, and only once a fix has
  arrived on the branch.** `.github/workflows/apply-correction.yml` merged as
  `steps.claude.outputs.github_token` -- the installation token
  `anthropics/claude-code-action` mints for itself -- and the last step the action runs
  revokes that token. So the merge step read a credential that had been dead for four tenths
  of a second: **both runs that got past the dispatch failed with `HTTP 401: Bad
  credentials` from `gh pr list`**, the first corrections ever to reach a session left
  unapplied on their branches. The merge is the workflow's own `GITHUB_TOKEN` now. Nothing
  is lost by the swap -- what that token cannot do is start a workflow, and the checks these
  steps wait on are on the head commit already, put there by the session's own push, which
  is made with the app token and is why the action is still handed no `github_token`.

  The 401 also stopped something worse. The action's `success` is the session having
  stopped without erroring, and that is equally what it does when it reads the plate, says
  what it would change and ends the turn -- which is what both of those runs did, the second
  of them in **38 turns and five minutes against a rebuild that alone takes ten**, and
  neither leaving `RAPir` on plate 28 any different. Had the token been alive, the step
  would have opened a pull request titled after the correction, squash-merged
  `corrections/<id>.json` onto main with nothing applied, and deleted the branch that was
  going to carry the fix. What is asked now is the branch rather than the exit code: a run
  merges only where `origin/main...origin/<branch>` carries a file outside `corrections/`,
  and where it does not the run fails with the session's own last message in the job
  summary, which is the only account the hidden transcript leaves of why it stopped. A
  second check refuses a branch whose fix edited the correction it was applying, by that
  correction's id and its snapshot with it: the file a reader drew is the record of what
  they said, and the `corrections/**` paths filter that keeps a fix commit from starting
  this workflow again rests on its never changing.

  The session is given a model now rather than the action's default. The work is long --
  eight steps, a ten-minute rebuild, then every check -- and it turns on a judgment the
  correction file does not make for it: which of the four causes the plate shows. The one
  correction of this kind carried the whole way, `och` on plate 22 (#79), was done on Opus,
  and the two runs that stopped five minutes in took the default; `claude_args` names
  `claude-opus-5`, the action having no model input of its own.

- **The browser suite stops reading a link before the page has read it.** `page.goto()` to
  the same file with a different fragment is a same-document navigation: nothing reloads,
  `window.__gae` is the one the spec has been driving all along, and `readHash` runs off the
  `hashchange` event in a task of its own. Three assertions sat across that gap. The one that
  fell over is in `multiview.spec.js`, where the wait -- `waitForFunction(() => !!window.__gae)`
  -- is satisfied by the object that is already there: on a runner slow enough it read pane A
  still holding what the clicks above had left it on, **`nissl` where the link says `myelin`**,
  which is how a branch whose whole diff is two files under `corrections/` came back red. The
  other two are in `colors.spec.js` and waited for nothing at all -- `writeHash()` a beat
  early writes out the `cw=70` the next link drops, and the SVG export is taken off the
  colors the last link set.

  All three go through `about:blank` now, which `smoke.spec.js` and `landmarks3d.spec.js`
  already did and `frameview.spec.js` covers with a sleep. That is the load a pasted link
  really is, and it is what makes the wait mean something: `window.__gae` is published after
  `readHash()` has run, both at the end of the script, so the spec still reads the panes the
  link set without waiting on a stack -- which is the thing it is there to assert. 109
  browser tests pass.

- **A pushed correction reaches the session it is addressed to.**
  `.github/workflows/apply-correction.yml` handed `anthropics/claude-code-action` the `push`
  that carries `corrections/<id>.json`, and the action reads the event that started it: it
  parses issues, pull requests and their comments and reviews, `workflow_dispatch`,
  `repository_dispatch`, `schedule` and `workflow_run`, and throws `Unsupported event type:
  push` on anything else before it looks at the prompt at all. So the workflow that carries
  every correction into the pipeline had never applied one -- **its first run ever, and the
  re-push after it, both failed the same way about a minute in**, with the branch and its
  file untouched.

  The push now dispatches this same workflow on the same branch, and the run that comes back
  does the work. That hop is one `GITHUB_TOKEN` is allowed to make -- `workflow_dispatch` and
  `repository_dispatch` are the two events it can raise -- so the dispatching job wants
  `actions: write` and no secret of its own, checks nothing out, and a dispatch runs the
  workflow file on the ref it names, so a correction is still applied by its own checkout of
  the pipeline. The `corrections/**` paths filter, which is what keeps the session's own
  pushes from starting this again, still sits on the push where it always did.

  What the hop costs is the actor: the second run is raised by the first, so it reads
  `github-actions[bot]` rather than whoever pushed, and the action refuses a non-human actor
  unless it is named -- hence `allowed_bots: github-actions`, which opens nothing to an
  account outside the repository, since only a workflow of this one is handed a
  `GITHUB_TOKEN`. The `correction` input is optional now, blank meaning what the push has
  always meant, every correction the branch adds to `main`; it is read through the
  environment rather than interpolated into the shell; and the one-run-at-a-time lock moves
  from the workflow to the applying job, so the dispatch is never queued behind the apply it
  is trying to start.

- **A draft in the region fixer stays on the plate it was made on.** The page kept one draft
  for the whole session and only rewrote its plate number when the plate changed, so a seed
  placed on plate 19 was still in the marks list on plate 20 -- drawn at the same page pixel,
  which on another plate is somewhere else entirely, and with its millimetres recomputed
  through the new plate's registration. A correction is one plate's: its marks are that
  page's pixels, and `page_px` is the only thing `tools/corrections.py` reads them by. The
  page now keeps a draft per plate. Leaving a plate puts its marks and its problem statement
  away under its number, arriving at one takes back whatever was left there, and the marks
  panel says which plates are still holding something. What carries across is the region
  being worked on, which is a choice about what to look at rather than a mark on a page --
  and `stands in for`, which names a printed box by its index on one plate and nothing at all
  on the next, is cleared with it.

- **Plate 20 is drawn the right way up in the region fixer.** The atlas prints that page at a
  quarter turn: it is 2481 x 3296 px where every other plate is 3296 x 2481, and its
  registration matrix is a rotation rather than a plain scale. The fixer draws in the page
  frame, so it drew the section lying on its side -- not the plate the book prints, and not
  what the app shows. The view is now composed with that same turn, snapped to a right angle
  so no scale or skew leaks in, and the page frame beneath it is untouched: the status bar,
  the probe and every `page_px` a correction carries are the page's own, unrotated, so
  `corrections/` and the pipeline never see this. The identity on the other 61 plates.

- **`src/fixer.js` and `src/fixer.css` are stored with the line endings `fixer.html` is built
  from.** `.gitattributes` marks the files that are checked byte-for-byte against a fresh
  build, and it had `src/app.js` and `src/app.css` but not the fixer's two. `fixer.html`
  inlines them verbatim, so on a clone with `core.autocrlf=true` they came out CRLF, the
  built page carried CRLF where the committed one has LF, and `tools/build_app.py --check`
  reported `fixer.html: STALE` on a tree nobody had touched.

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

- **`S1` gets its left hemisphere on plate 24, and the stria terminalis gives back the
  cortex it was holding.** The word printed in the left somatosensory band on plate 24 is
  `S1`, between `S1ULp` above and `S2` below. The label pass read it as `st`, so
  `label_positions` carried a third box for the stria terminalis at ML −5.83, DV −4.31 — the
  mirror of the real `S1` box at ML +5.65, DV −4.26 — and that box seeded the left `S1` face
  as stria terminalis. Nothing downstream could recover: `S1` came out with one ring on the
  plate where every neighbour drawn beside it (`S1ULp`, `S2`, `GI`, `DI`, `AI`, `S1BF`) has
  ground in both hemispheres, and the septum and basal forebrain division, which holds `st`,
  painted a wedge of lateral cortex four and a half millimetres lateral of the stria it
  names. That wedge is what a reader saw and reported.

  The box is moved from `st` to `S1` in `label_positions` and the extents re-cut. **`S1` on
  plate 24 goes 0.8575 to 1.4004 mm², one ring to two**, the new one the mirror of the old:
  ML −6.55 to −4.49 against +4.49 to +6.53, DV −4.54 to −3.97 against −4.59 to −3.92. **`st`
  goes 0.8803 to 0.3374 mm², three rings to two**, which is the two the atlas prints, beside
  `ic` in each hemisphere. Exactly 0.5429 mm² moves from one to the other and nothing else on
  plate 24 moves at all — the whole-atlas re-cut changes two (plate, region) entries and no
  others. Over the series `S1` goes 12.811 to 13.354 mm² and 3.7425 to 4.0888 mm³, `st` 4.529
  to 3.986 mm² and 1.3610 to 1.2881 mm³ and six mesh components to five. `S1`'s reported
  center flips from ML +5.88 to −5.80: the table gives the center of the largest mesh
  component, and the left one is now the larger. `boundary_edges_shared_exactly` stays 1.0,
  the located-label count is unchanged at 6346 — one box changed owner, none was added or
  lost — and so is the count of (plate, name) pairs, 3350, because `st` keeps two boxes on
  plate 24 and `S1` already had one there.
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
- **A plate slider under the region fixer's canvas.** The header steps one plate at a time;
  this crosses the brain in one drag, the way the atlas's own view does. The number and the
  bregma follow the thumb at once -- both come from the boot list, so they read before the
  plate has landed -- while the plate itself, which is a fetch of the tracing, the cut and a
  scan, waits for the drag to settle; overlapping loads are stamped, so a plate overtaken on
  the way is dropped rather than drawn. Under the track it marks the plates that have marks
  waiting on them, which is the only way a draft left behind on another plate is visible from
  here. On a phone the two end words give up their room to the track.

- **A staining apiece in the split 3-D view: A on the Nissl, B on the myelin.** Which of the
  plate's sources the stack is read from now belongs to the **pane** rather than to the view,
  so **Labeled / Nissl / Myelin / MRI** sets the pane the rest of the 3-D toolbar is on, the
  way the mode, the slab and the camera already do — and the split can stand a Nissl stack
  beside a myelin one. The atlas prints those two stains on consecutive pages of every one of
  the 62 levels, and turning between them is the comparison it sets up and cannot itself
  complete: this is the same 62 levels stacked twice, in the same coordinate box, at the same
  angle, cells on one side and tracts on the other. Everything drawn over them — the plate
  ring, the label cloud, the meshes, the skull, the landmarks — lands in the same place in
  both panes. The drawing beside either of them is the third pairing, and the MRI beside all
  three is the fourth. What it is not is the same tissue twice: the myelin page is an
  adjacent section, as it always was, so a feature can sit a section's thickness from where
  the Nissl has it.

  A pane opens as a copy of the one it was split from, staining included, so a split still
  changes nothing about the picture. The GPU holds one stack per staining a *drawn* pane is
  on: one where the panes agree — every view that was possible before they could differ — and
  two where they do not, at 24 MB apiece. Putting a pane back onto a staining the other one is
  holding costs nothing and reads nothing, and folding the split away hands back the stack
  nobody is looking at rather than keeping it against a return to it. Reading a second one
  costs the few seconds the first cost and says which staining it is reading while it runs;
  the stack of the pane waiting for it is the only thing that goes missing meanwhile — that
  pane's shell, meshes, labels and ring keep drawing, and the other pane is not interrupted at
  all. The pane letters carry the staining while the two differ (**A · Nissl**, **B · Myelin**)
  and stay bare letters while they agree: the toolbar can only ever speak for the pane it is
  on, and a picture is better off with less written over it. The note under the view names the
  other pane's source on the same grounds, with the one caveat that pair carries and the
  others do not — the myelin page is an adjacent section, so the two panes share the level
  rather than the tissue.

  A link carries B's staining as `&ps32=`, under `ps3`'s name with the pane's `2` on it like
  every other second-pane parameter, and writes it only where B is on something other than A —
  so every link ever written still reads as exactly the view it was written from, and a split
  on one staining still writes the link it always wrote. `ps3` still names A, which is the
  whole view wherever there is one pane, and a link carrying only `ps` still sets the plate
  and the stack together, which is what it always meant. See
  [METHODS](METHODS.md#the-3-d-view).
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
