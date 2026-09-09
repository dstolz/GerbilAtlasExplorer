# Plan — the correction process, from `fixer.html` to main

A reevaluation of how a correction to a region travels: marked on the plate in
`fixer.html` (or `tools/atlasfix.py`, or `matlab/AtlasRegionFix.m`), pushed as
`corrections/<id>.json` on a `correction/<id>` branch, applied by a Claude Code session
under `.github/workflows/apply-correction.yml` following
`.claude/skills/atlas-region-fix/SKILL.md`, opened as a pull request, read, and merged.
Written after the first two corrections to go the whole way, `RAPir` on plate 28 (#109)
and `E` on plate 3 (#110), on 2026-09-08/09. The aim is two things: fewer merge conflicts,
and a session that spends its turns on the judgment only it can make.

## What the first two corrections cost

Both corrections were pushed from the published fixer, one on the evening of the 7th, one
the next morning. What happened after is in the workflow's run history and the two
branches' commit logs.

| | `E`, plate 3 (#110) | `RAPir`, plate 28 (#109) |
| --- | --- | --- |
| Pushed | 09-07 21:22, as two commits (json, then png) | 09-08 10:26, as two commits |
| Workflow runs raised by the push | 2 (both failed: `push` was not an event the action read) | 4 (2 dispatched sessions, both stopped in 7 and 14 min with nothing pushed) |
| Merges of main into the branch before a fix existed | 2 | 2 |
| Session that produced the fix | run 11, 22:55, 44 min, ended red on a `gh` flag | run 10, 22:55, 39 min, ended red on the same flag |
| Merges after the fix | 3 (01:00 stacking on RAPir, 01:18, 02:02 after #109 squashed), two of them full re-cuts of the atlas | 2 (00:40 with main, 01:16), one a full re-cut |
| Sessions re-run by those merges, to no purpose | 1 (run 15, 34 min) | 1 (run 13, 42 min; it also changed `tools/corrections.py`, duplicating #112) |
| Commits on the branch at the end | 19 | 8 |
| Workflow-plumbing pull requests in the same day | #105, #106, #107, #111 | |

Of fifteen runs of the workflow, two applied a correction. The rest were plumbing
failures, duplicate dispatches, or sessions re-run on a branch that already carried its
fix. Every merge of main after the fix conflicted in every derived file, and every one was
resolved the same way by hand: take main's derived files, lay the branch's input on them,
run the pipeline again, check that the corrected region's polygons came out identical.

## Where the conflicts come from

A correction changes one input on one plate: rows of `seed_overrides`, a `<path>` in one
plate's SVG, a box in `label_positions`, a ring in `brain_outline`. That input is
plate-local and small. What the branch commits is the input plus everything cut from it,
and most of that is global:

| File | Changes on every correction | Conflicts between two corrections on different plates |
| --- | --- | --- |
| `data/gerbil_atlas.json`: `seed_overrides.data[plate]` | yes, on its own line | no (unless the same plate) |
| `data/gerbil_atlas.json`: `seed_overrides.note` | yes -- the note enumerates the rows and carries a paragraph per correction | **always** |
| `data/gerbil_atlas.json`: `region_extents.data[plate]` | yes, one line per plate | no |
| `data/gerbil_atlas.json`: `region_extents.summary`, `.validation`, `verification`, `version.generated` | yes | **always** |
| `data/gerbil_atlas_volumes.json` | yes, one 20 MB line | **always** |
| `data/gerbil_atlas_labels.nii.gz` | yes, binary | **always** |
| `data/gerbil_atlas_structure_table.csv` | rows for the structures that moved | when rows are adjacent |
| `data/geojson/plate_NN.geojson`, `data/facemaps/plate_NN.json` | the one plate | no |
| `index.html`, `gerbil_atlas_explorer.html` | the build stamp, and `window.__REGION__` as one line | **always** |
| `fixer.html` | the build stamp only | **always** |
| `CHANGELOG.md` | an entry at the top of `### Fixed` | **always** |
| `METHODS.md` | the totals under Region extents (polygons, points) | usually |
| `qc/chk_corr_<id>*.png`, `corrections/<id>.*` | new files | no |

So two correction branches conflict with each other and with any re-cut on main in six
to eight files regardless of what they correct, and none of the conflicting content is
something a person should resolve by hand. Two further mechanics made it worse than that:

- **Squash merging a branch another branch had merged.** #110 merged the `RAPir` branch to
  stack under it; #109 then landed as a squash, a different commit with the same content,
  and #110 conflicted with main in every derived file again.
- **A merge commit re-runs the workflow.** The `corrections/**` paths filter matches a
  merge that brings main's `corrections/README.md` or the other branch's correction file
  in, so merging main into a branch that already carries its fix dispatched a 40-minute
  session, which found nothing to apply and, in one case, edited a tool instead.

## Where the session's time goes

The session is asked to do eight things. Ranked by how much of them is judgment:

1. Decide which of the four causes the plate shows -- judgment, and the reason the
   session exists.
2. Decide between two fixes for that cause when `inspect` offers both -- judgment.
3. Write the cause up in the repository's voice -- judgment, mostly.
4. Run `inspect --qc` and read the picture -- deterministic; the session spends its first
   turns on setup that could be handed to it.
5. Run `apply`, then seven build steps in order, then eight checks -- deterministic;
   fifteen commands, an ordering to get right, and a missed one (`build_facemaps.py`) is
   what `--check` catches an hour later in CI.
6. Compute the numbers for the write-up -- area before and after, per hemisphere and over
   the series, the per-(plate, region) diff against main, mesh components, the summary
   deltas -- deterministic, done today with ad hoc Python, and re-done by hand at every
   rebase because the numbers are stated against a base that moved (168,740 -> 168,751
   became 168,729 -> 168,740).
7. Run Playwright -- CI runs it on the same push, and the workflow waits on CI.
8. Commit, push, `gh pr create` with the picture pinned to the sha -- deterministic, and
   the one step that needs a credential the session would otherwise not need.

A rough split from the two successful runs: about ten minutes of the forty is the
rebuild, five to eight is checks and Playwright, and the rest is turns, of which the
setup, the number-gathering and the pull request mechanics are more than the diagnosis.

## The plan

Four parts, in the order to do them. The first two are small and remove most of the
waste; the third is the structural change that makes conflicts a non-event; the fourth
is what to consider only if the volume of corrections grows.

### 1. Stop the duplicate and pointless runs

Cheap, and worth doing before anything else.

- **One commit per correction.** `fixer.html` pushes the json and the png as two
  `contents` PUTs, so two push events, two dispatches, two sessions queued on one branch.
  Use the Git Data API (blob, tree, commit, ref: four calls) or PUT the png first and the
  json last so that only the last push carries a `.json`. `atlasfix.py` and the MATLAB
  tool already make one commit.
- **A pushed merge is not a correction.** In the `dispatch` job, fire only when the push
  adds a correction file on its first parent: fetch the branch at depth 2 and test
  `git diff --diff-filter=A --name-only HEAD^1..HEAD -- 'corrections/*.json'` is
  non-empty and `HEAD` has one parent. In the `apply` job, before installing anything,
  test whether `origin/main...HEAD` already carries a file outside `corrections/`; if it
  does, stop with "already applied" unless the dispatch input says otherwise. The 40-minute
  session becomes a one-minute check.
- **The session does not touch tools.** Add to the skill's Never list: a correction run
  changes pipeline inputs, the docs and `qc/`; never `tools/`, `src/`, `tests/` or the
  workflows. If a tool is wrong, the pull request says so. Run 13 fixed the site-picture
  window in `tools/corrections.py` while #112 fixed it on main.
- **Test the plumbing without a session.** The four shell blocks in
  `apply-correction.yml` were each fixed once in a day. Move them to `tools/ci/` as
  scripts with tests under `tests/python`, and give `workflow_dispatch` a `dry_run` input
  that runs every step but the session, so a flag that `gh` does not have fails in two
  minutes rather than after forty.
- **No stacking.** A correction branch is cut from main and merges nothing but main. Two
  corrections that must land together go on one branch as two files, which the workflow
  already handles.

### 2. Hand the session what is deterministic

Each of these takes a class of turns out of the session and makes its output
reproducible by a job with no model in it.

- **`tools/pipeline.py rebuild` and `tools/pipeline.py check`.** The seven build steps in
  order, and the eight checks, as two commands. The skill's step 5 and step 6 become one
  line each; `--plates NN` on `rebuild` runs the `--dry-run --qc` confirmation of step 4.
  Nothing new is computed; the order and the completeness stop being the session's to
  remember.
- **`tools/corrections.py report <id> [--against origin/main]`.** Emits, as Markdown, the
  numbers the write-up needs: the region's area and polygon count before and after, per
  hemisphere and over the series; the per-(plate, region) diff against the base, with a
  one-word reason where it can give one (wall shared with the corrected face; volume
  interpolation on a neighbouring plate); mesh component counts that changed; the summary
  and verification deltas; `boundary_edges_shared_exactly`; the checks' results. The
  session writes the prose and pastes the tables. The rebase job (part 3) re-emits the same
  report on a new base, so the numbers in the pull request never go stale.
- **Run `inspect --qc` before the session.** The workflow already has the correction file
  and the pipeline installed; run `inspect --qc` in a step and put its text in the prompt.
  The session opens on the diagnosis rather than on setup.
- **Drop Playwright from the session.** CI runs it on the session's push and the workflow
  waits on that CI. Keep the Python `--check`s in the session, since they decide what is
  committed. The apply job then needs no Node at all.
- **The workflow opens the pull request.** The session writes `build/pr_body.md`; the
  last step of the workflow opens the pull request from it, with the site picture pinned
  to the sha it just read off the branch. The session needs no `gh`, the workflow's own
  token does the one thing it can do, and the fallback that exists today becomes the only
  path.
- **The reader's own recut travels with the correction.** `atlasfix.py`'s **Recut** shows
  what the pipeline will build before the reader commits. Write what it showed into the
  file -- `"preview": {"area_mm2": ..., "changed": [...]}` -- so the session can check its
  result against what the reader accepted, and the report can say whether they agree. The
  published page cannot recut and leaves the field out.

### 3. Make the rebase mechanical

This is the change that makes conflicts stop mattering. It is what was done by hand three
times on the night of the 8th, as a script and a job.

**`tools/corrections.py rebase`** (or `tools/rebase.py`), run on a correction branch:

1. `git merge --no-commit origin/main`.
2. For every conflicted path that is derived -- the list is fixed and lives in one place,
   `atlaslib.DERIVED`: `region_extents`, `region_colors`, `features`, `verification`,
   `version`, `plate_registration`, the `n_*` counts in `plates[]` inside the database;
   `data/gerbil_atlas_volumes.json`, `data/gerbil_atlas_labels.nii.gz`,
   `data/gerbil_atlas_*.csv`, `data/geojson/*`, `data/facemaps/*`, the three pages -- take
   main's copy.
3. For `data/gerbil_atlas.json` specifically: take main's file, then lay the branch's
   input delta on it -- the difference between the merge base and the branch head in
   `seed_overrides.data`, `label_positions.data`, `brain_outline.data`, `label_leaders`,
   `label_blocks`, keyed by plate. A delta on a plate main also changed is the one real
   conflict, and the script stops and says so.
4. `svg/` conflicts only on the same plate; the same rule.
5. `CHANGELOG.md`: keep both sides' entries (part 3b below makes this a non-conflict).
6. Run `pipeline.py rebuild` and `pipeline.py check`.
7. Assert: the set of (plate, region) entries that differ from main equals the set that
   differed from the old base, less the entries main moved itself; and the corrected
   region's polygons are identical to the branch's before the rebase. Print the report.
   If the assertion fails, leave the tree for a person or a session and exit non-zero.
8. Commit as a merge, with the report as the body.

**The job.** A workflow on `push: branches: [main]` lists the open pull requests whose
head is `correction/*` and dispatches the rebase for each, under one concurrency group so
they run one at a time, each on the main the last one left. No model in it. When the
assertion holds, the pull request is current with main and CI runs on the new head; when
it does not, the job comments on the pull request with the report and stops, and the
apply workflow can be dispatched by hand with a prompt that says what to look at.

**Merge method.** With no stacking, squash is fine and keeps main's history one commit
per correction. Turn off "allow merge commits" on the repository so the choice cannot be
made differently by accident.

Once this exists the session's own step 1 (merge main first) is the same script run at
the start of the apply job, on a branch that carries nothing but the correction, where it
is trivial.

### 3b. Shrink the surface that conflicts for no reason

These are independent of the rebase script and each removes a file from the
always-conflicts column. Do them in this order.

- **`CHANGELOG.md` fragments.** One file per change under `changelog.d/<id>.md` (the
  correction id for a correction, the branch name otherwise), assembled into
  `CHANGELOG.md` under `## [Unreleased]` by a script at release, or by a job on merge to
  main. The one file every pull request edits at the same line stops being edited by any
  of them. The repository's voice is unaffected: a fragment is the entry.
- **`seed_overrides.note` stops enumerating.** The note counts the rows and carries a
  paragraph per correction; the row's fifth field already holds the reason, and the
  correction file and its pull request are the record. Make the note one static sentence
  about what the block is. Same for any other block note that enumerates cases
  (`brain_outline.note`).
- **`METHODS.md` numbers from the pipeline.** The totals under Region extents that every
  correction moves (polygons, points, entries, `seeds_moved_by_hand`) go between markers,
  `<!-- n:points -->168,751<!-- /n -->`, that `export_tables.py --refresh-db` rewrites
  and `--check` verifies. The session never edits a total again, and a rebase never
  restates one.
- **Unstamp the committed pages.** `pages.yml` builds the site from the commit it deploys
  and stamps it then; the stamps in the committed `index.html`,
  `gerbil_atlas_explorer.html` and `fixer.html` are cosmetic and `build_app.py --check`
  already compares unstamped. Commit them with the `{{BUILD_HASH}}` placeholders and every
  pull request that touches no data stops conflicting on three files. The
  `window.__REGION__` line still conflicts between two re-cuts; the rebase script handles
  that, since the page is derived.
- **One line per structure in `gerbil_atlas_volumes.json`.** Twenty megabytes on one line
  conflicts on every pair and makes every pull request diff unreadable. A newline after
  each structure's mesh changes no byte a reader parses and makes the diff the list of
  structures that moved. Mark it and the NIfTI `-diff` in `.gitattributes` so GitHub does
  not try to render them.

### 4. Only if the volume grows: derived files off the branches

The complete answer is that a correction branch carries inputs, docs and pictures and
nothing derived, and a job on main rebuilds the derived files after every merge and
commits them. Conflicts between corrections are then confined to the same plate, CI on a
branch builds into `build/` rather than checking committed files, and Pages deploys from
the bot's commit. It is a change to the repository's contract -- today "committed equals
fresh build" is what every `--check` means and what a reviewer reads in the diff -- and
it would apply to every re-cut, not only corrections (#108 was one). Parts 1 to 3 get the
same outcome for the correction path at a fraction of the change, so this is noted as the
next step and not planned.

## What the reader sees, and should keep seeing

The pull request as #110 has it is the right shape: the site picture first, the cause,
the fix, a table of what moved and why, the reading taken and the one not taken, the
checks. Nothing above changes that. What changes is that the numbers in it come from
`report`, so they are the same numbers a rebase prints and a reviewer can regenerate, and
that the picture and the body are pinned by the workflow to the head it read rather than
by the session to the head it hoped it pushed.

## Sequence

| Step | Part | Effort | What it removes |
| --- | --- | --- | --- |
| 1 | 1: dispatch on added files only; apply exits when a fix exists | an hour | every pointless 40-minute session |
| 2 | 1: one commit from `fixer.html` | an hour | the double dispatch |
| 3 | 1: skill scope rule; scripts and `dry_run` for the workflow shell | half a day | a class of plumbing pull requests |
| 4 | 2: `pipeline.py rebuild` / `check` | half a day | ordering mistakes; ten commands from the skill |
| 5 | 2: `corrections.py report` | a day | ad hoc number-gathering; stale numbers after rebase |
| 6 | 2: `inspect` before the session; Playwright out; workflow opens the PR | half a day | setup turns; a credential; Node in the apply job |
| 7 | 3b: changelog fragments; static block notes; METHODS markers | a day | the three hand-edited conflicts |
| 8 | 3: `rebase` script and the on-main job | two days | every derived-file conflict, and the hand resolution of it |
| 9 | 3b: unstamped pages; one line per mesh | half a day | cosmetic conflicts; unreadable diffs |

Steps 1 to 3 first, in one pull request. Steps 4 to 6 next; they change the skill and
the workflow together. Step 7 before step 8, so the rebase script never has to merge
prose. The open pull request #110 is current with main as of 02:02 on the 9th and does
not wait on any of this.
