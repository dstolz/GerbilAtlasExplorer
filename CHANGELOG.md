# Changelog

All notable changes to this repository are recorded here. The data files carry a
`version` field that matches the release they were built for.

## [Unreleased]

### Added
- LICENSE (MIT, code), LICENSE-DATA.md (CC BY 4.0, derived data), CITATION.cff.
- Source split: the app now lives in `src/` (`app.html`, `app.css`, `app.js`) and the
  single-file `gerbil_atlas_explorer.html` is built by `tools/build_app.py`, which
  stamps the commit hash and build date into the About dialog.
- `tools/atlaslib.py`: the pipeline's shared paths, frame formulae, JSON block
  writer, SVG readers and `--plates` parser.
- `tools/export_tables.py`: the CSVs, a per-label coordinate table, a per-structure
  table, GeoJSON extents per plate, and `--check`.
- `data/plates/`: the 186 plate images as files; `data/skull.json`.
- A lean `index.html` that loads histology, skull and tracings on demand, with a
  service worker for offline use after the first visit.
- Tests: `tests/python` (pytest over the committed data and `atlaslib`) and
  `tests/js` (Playwright smoke and API tests), run by GitHub Actions.
- Track planner: structures along the track with depth ranges, and a probe length.
- Injection footprint, structure gallery strip, compare view, annotations,
  3-D meshes on demand, fuzzy search with cross-nomenclature aliases.
- Exports: per-label CSV, plan JSON, labelled SVG with one group per structure.
- Accessibility: tab roles, live regions, focus outlines, labelled inputs.

### Fixed
- The app's structure table and `data/gerbil_atlas_structures.csv` carried the
  pre-correction plate ranges for AngT, RLi, Su3C and ZIC.
- `plates[].n_labels_located`, `plates[].ocr_confirmed` and `plates[].n_structures`
  were stale; the `thalamus` alias resolved to nothing.
- `build_region_extents.py --plates` and `build_volumes.py --plates` no longer write
  a partial block over the committed data.
- `--check` flags now exit non-zero when something is stale.
