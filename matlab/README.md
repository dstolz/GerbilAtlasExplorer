# matlab

`AtlasRegionFix.m` is how a wrong region gets reported from MATLAB and fixed on the
site without anyone drawing a polygon into the data by hand.

The app draws no region by hand. `region_extents` is cut by `tools/build_region_extents.py`
from the traced outlines in `svg/` and the printed labels (the seeds), so a region that
comes out wrong is one of those inputs being wrong: a run of boundary the tracing missed,
a seed dropped in the wrong face, an island the section outline lost, a label never read.
What a reader can say from the plate is *where the region is* and *where its boundary
runs*. This class lets you say it on the plate, in millimetres, and sends it.

## What happens

1. `AtlasRegionFix(plate)` brings the plate down from the website into a local cache: the
   drawing (and the Nissl, myelin and MRI plates on request), the tracing in `svg/`, the
   extents as they stand (`data/geojson/plate_NN.geojson`), the printed labels and their
   leader lines (`data/gerbil_atlas_labels.csv`), and the frame and registration from
   `data/gerbil_atlas.json`. With `'Repo'` naming a local clone it reads from that instead.
2. `show` lays them over each other in stereotaxic mm: red tracing (dashed where the atlas
   prints it dashed), every region faint and the one you `select` bold, each printed label
   as a yellow box with its line and tip where the atlas draws one, the section outline.
3. You mark what is wrong. `addSeed` is a point that is (or, `'Kind', 'negative'`, is not)
   inside a region. `addBoundary` is a run of boundary the tracing missed, clicked or drawn
   freehand; its ends snap to the traced ink so the pipeline can seal it. `addExtent` puts
   the region's own outline up as an editable polygon to pull into shape. `problem` and
   `note` say why.
4. `preview` cuts the plate into faces the way the pipeline does -- ink, bridged ends,
   section interior -- and says for each seed which face it lands in, how big it is, which
   printed labels seed the same face, and who owns the point today. It paints the face on
   the figure. No Python involved.
5. `commit` writes `corrections/<id>.json` (and a PNG of the figure) on a branch
   `correction/<id>` and pushes it. Through a clone that is a temporary git worktree, so
   your own checkout is untouched; without one it is a single commit made through the
   GitHub API with a token.
6. The push starts `.github/workflows/apply-correction.yml`: a Claude Code session follows
   `.claude/skills/atlas-region-fix/SKILL.md` -- reads the file with
   `tools/corrections.py inspect`, decides which input is at fault, fixes that input
   (`apply` writes boundaries into the SVG and seeds into `seed_overrides`), rebuilds the
   extents, meshes, tables and pages, runs every check, writes the CHANGELOG and METHODS
   entries, and opens a pull request. The workflow merges it once CI is green, and GitHub
   Pages serves `main`, so the site updates on the merge. The pull request and
   `qc/chk_corr_<id>.png` are the record.

## Setup

- MATLAB R2021a or later with the Image Processing Toolbox. Put `matlab/` on the path.
- **To commit through a clone** (recommended): `git` on the PATH and a clone you can push,
  with whatever credential helper you already use.
  ```matlab
  A = AtlasRegionFix(19, 'Repo', 'C:\src\GerbilAtlasExplorer');
  ```
- **To commit without a clone**: a fine-grained personal access token for
  `dstolz/GerbilAtlasExplorer` with *Contents: read and write*, in the environment as
  `GITHUB_TOKEN` (or `A.Token = '...'` for the session).
- **Once, on the repository**, for the workflow that applies corrections: run `claude
  /install-github-app` from a local terminal in the clone, taking the subscription option.
  It installs the Claude GitHub App *and* writes the one secret the workflow reads,
  `CLAUDE_CODE_OAUTH_TOKEN`, and offers a pull request adding `.github/workflows/claude.yml`
  -- the separate "@claude on a pull request" workflow, worth keeping. It needs a browser,
  repository admin and `gh auth login`, so it cannot be run from a cloud session. By hand it
  is `claude setup-token`, `gh secret set CLAUDE_CODE_OAUTH_TOKEN`, and installing the App
  from https://github.com/apps/claude. The token lasts a year and is tied to whoever ran the
  command; when it lapses the *Apply them* step fails to authenticate and the correction sits
  untouched on its branch.
- **Also once**: Settings → General → *Allow auto-merge*, and a branch-protection rule on
  `main` requiring `python-checks (3.11)`, `python-checks (3.12)` and `browser-tests`, with
  approvals at zero so the workflow can merge unattended. Without the rule GitHub refuses to
  arm auto-merge and the workflow idles on the checks itself instead.

## A worked example

The case of #77, S1DZ on plate 19: a scrap on the left against a proper band on the
right, because the tracing had missed a 30 px run of the dashed S1J/S1DZ boundary.

```matlab
A = AtlasRegionFix(19);                       % from the site, cached under prefdir
A.show                                        % the plate in mm
A.select('S1DZ')                              % prints its area, rings, boxes: S1DZ[0], S1DZ[1]
A.zoomTo('S1DZ')
A.problem('S1DZ on the left is a scrap against a proper band on the right; S1J bulges through a gap in the dashed S1J/S1DZ boundary.');
A.addSeed('S1DZ', [-4.13 -2.88]);             % a point inside the strip; or A.addSeed('S1DZ') and click
A.addBoundary('Style', 'dashed');             % click along the missing run, double-click to finish
A.preview                                     % the seed now sits in a face nobody letters -> the boundary seals it
A.commit                                      % corrections/<id>.json on correction/<id>, pushed
```

`A.report` lists the marks; `A.undo` drops the last; `A.save(file)` and
`AtlasRegionFix.load(file)` keep a draft between sessions; `A.setLayer('nissl')` swaps the
plate under the overlays; `A.commit('DryRun', true)` writes the file beside the cache and
stops, which is the way to look at what would be sent.

When a printed box itself seeds the wrong face (OV on plate 5, #78), say which box the
seed stands in for: `A.addSeed('OV', [ml dv], 'Replaces', 1)` -- the indices are the ones
`select` prints and the figure shows beside each box. Without `'Replaces'` the seed is added
beside the printed ones, which is right when a face is simply unlettered.

## What is written

`corrections/<id>.json`, schema `gerbil-atlas-correction/1`; see `corrections/README.md`.
Every point is stored in the page frame the tracings are in (`page_px`) with the
millimetres beside it (`mm`), and `tools/corrections.py validate` refuses a file where the
two disagree, which is the check on this class's transforms. The id is the UTC time, the
plate and the abbreviation: `20260905T160102Z-p19-S1DZ`.

## When something goes wrong

- The workflow fails at *Apply them*: the secret is missing or expired (see Setup). The
  branch and the file are still there; re-run the workflow from the Actions tab once the
  secret is in place.
- The pull request stays open: CI went red or the session could not settle the case; it
  says why in the pull request. Nothing has reached the site.
- `preview` says an end of a boundary is beyond `BRIDGE_PX`: draw it onto the traced line,
  or leave `'Snap'` on so it is pulled there.
- `preview` says a seed would split a face the atlas letters with one other name: the
  face is drawn as one region on the page; what is missing is a boundary, not a seed.
