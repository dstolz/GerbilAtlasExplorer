"""The atlas's own reference MRI, as plate images and as a volume.

`Gerbil4atlas_MRI.tif` is a 256 x 256 x 72 uint16 stack of the atlas animal's head,
written by InsightToolkit. It is not a new dataset needing registration: it is already
in the atlas's stereotaxic frame, one slice per plate, and this script only has to say
so precisely and resample it into the frame the app draws in.

Three outputs:

  data/plates/mri/NN.jpg   slice 62-NN, resampled into the plate frame (550 x 352)
  data/mri_volume.jpg      all 72 slices as one 8 x 9 tile sheet, in voxel space
  mri_frame                the calibration, written into data/gerbil_atlas.json

`mri_frame` carries the same six keys `atlaslib.Frame` reads, so `A.Frame(db['mri_frame'])`
converts voxels to millimetres with no new arithmetic anywhere. Composing it with
`A.Frame(db['plate_frame'])` is the whole of the resampling below.

The plate images go under data/plates/ so that `atlaslib.plate_path` and
`build_app.site()`'s copytree pick them up unchanged. Two things they must NOT do:

  * `mri` is not in `atlaslib.KINDS`. The tests walk KINDS and require all 62 files at
    exactly 1100 x 703; this source is optional and deliberately smaller than that.
  * They are not a `@blob`. `build_app.py --check` compares the committed pages
    byte-for-byte against a fresh render, so a blob built here with the volume present
    and rebuilt in CI without it fails the gate; and `images_payload(lean=True)` emits
    URLs without checking the files exist, which would light the toolbar button up on a
    site where every plate 404s. The app reaches these by runtime fetch instead.

Everything is a no-op with a message when the TIFF is not there, because redistribution
rights for it are unsettled and the site has to build without it.

    python tools/build_mri.py --tif PATH        # write everything
    python tools/build_mri.py --verify          # re-run the registration check
    python tools/build_mri.py --dry-run         # say what would be written

Run with PYTHONUTF8=1, as the other tools here need.
"""
import argparse
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import atlaslib as A                                             # noqa: E402

MRIDIR = os.path.join(A.PLATES, 'mri')
SHEET = os.path.join(A.DATA, 'mri_volume.jpg')
DEFAULT_TIF = os.path.join(
    'G:', os.sep, 'Shared drives', 'CarasLab',
    'SCIENTIFIC RESOURCES- PAPERS, TEXTBOOKS, ETC', 'Gerbil Atlas', 'Gerbil4atlas_MRI.tif')

# ---------- the calibration ----------
#
# The in-plane spacing is the TIFF's own XResolution and is checked against the file on
# read rather than trusted. The slice spacing is NOT in the file - there is no
# ImageDescription and no z tag - and was recovered; see `derivation` below. The AP
# numbers are not constants here at all: they come from the plate table, which is what
# makes `plate = 62 - slice` a statement about the atlas rather than a magic number.
COLS, ROWS, SLICES = 256, 256, 72
ML_ZERO_COL = 126.25            # the midsagittal plane, in MRI columns
DV_ZERO_ROW = 44.5              # the atlas's DV zero plane, in MRI rows
IN_PLANE_MM = 0.117             # expected; verified against XResolution on read

EMIT_W, EMIT_H = 550, 352       # 3.3x the 165 voxels the frame spans: 1.4 MB, not 3.5
QUALITY = 85
WINDOW = (0.5, 99.8)            # percentiles of the whole volume, for the 8-bit window
SHEET_COLS = 8


def slice_of(plate):
    """Plate -> slice. Plate 62 is slice 0; plate 1 is slice 61; 62-71 are rostral."""
    return A.N_PLATES - plate


def load_tif(path):
    """The volume as float32 (slices, rows, cols), and the in-plane mm the file states."""
    from PIL import Image
    import numpy as np
    with Image.open(path) as im:
        n = getattr(im, 'n_frames', 1)
        got = (im.size[0], im.size[1], n)
        if got != (COLS, ROWS, SLICES):
            raise SystemExit('%s: expected %s, got %s'
                             % (path, (COLS, ROWS, SLICES), got))
        xr = im.tag_v2.get(282)
        unit = im.tag_v2.get(296, 2)
        vol = np.stack([np.array(im.seek(i) or im) for i in range(n)]).astype(np.float32)
    if not xr:
        raise SystemExit('%s: no XResolution; cannot confirm the in-plane spacing' % path)
    mm = (25.4 if unit == 2 else 10.0) / float(xr)
    if abs(mm - IN_PLANE_MM) > 5e-4:
        raise SystemExit('%s: in-plane spacing is %.5f mm, expected %.3f'
                         % (path, mm, IN_PLANE_MM))
    return vol, mm


def window(vol):
    """The whole volume scaled to 0..1 on one window, so the plates are comparable."""
    import numpy as np
    lo, hi = np.percentile(vol, WINDOW[0]), np.percentile(vol, WINDOW[1])
    return np.clip((vol - lo) / (hi - lo), 0, 1), float(lo), float(hi)


def mri_frame_block(db, mm, lo=None, hi=None, residual=None):
    """The calibration, recorded the way `plate_frame` is: numbers plus how they were got.

    The first six keys are exactly what `atlaslib.Frame` reads, so this block is usable
    as a Frame without adapting anything.
    """
    plates = db['plates']
    ap_first = plates[-1]['bregma']                  # plate 62, which is slice 0
    step = db['conventions']['spacing_mm']
    block = {
        'note': "Converts a voxel of the atlas's own MRI into stereotaxic millimetres. "
                "The volume is already in the atlas frame, one slice per plate, so "
                "nothing here is fitted along AP: plate = %d - slice. The first six keys "
                "are the ones atlaslib.Frame reads." % A.N_PLATES,
        'width_px': COLS,
        'height_px': ROWS,
        'ml_zero_px': ML_ZERO_COL,
        'ml_px_per_mm': round(1.0 / mm, 6),
        'dv_zero_px': DV_ZERO_ROW,
        'dv_px_per_mm': round(1.0 / mm, 6),
        'n_slices': SLICES,
        'ap_first': ap_first,
        'ap_step': step,
        'in_plane_mm': round(mm, 6),
        'ml_mm': '(col - ml_zero_px) / ml_px_per_mm',
        'dv_mm': '(dv_zero_px - row) / dv_px_per_mm',
        'ap_mm': 'ap_first + ap_step * slice',
        'plate_of_slice': '%d - slice; slices %d-%d lie rostral of plate 1'
                          % (A.N_PLATES, A.N_PLATES, SLICES - 1),
        'emit_px': [EMIT_W, EMIT_H],
        'derivation':
            "ml_px_per_mm and dv_px_per_mm are the TIFF's own XResolution "
            "(217.094 pixels per inch, i.e. 0.117 mm/px), read off the file and checked "
            "on load rather than fitted. ap_step is the one number the file does not "
            "carry - there is no ImageDescription and no z tag - and was recovered: it "
            "is conventions.spacing_mm, the atlas's own plate spacing, and "
            "plate_of_slice then falls out identically rather than being fitted. "
            "ml_zero_px is the column minimising the left-right mirror difference over "
            "the cerebral slices; dv_zero_px is the atlas's DV zero, fitted by "
            "maximising the image gradient under the brain_outline rings.",
        'validation':
            "Projecting brain_outline onto the MRI under this map, with no AP fitting at "
            "all, leaves no systematic bias in either in-plane axis: over all 62 plates "
            "the median best whole-pixel shift is 0.000 mm in both DV and ML, with a "
            "per-plate scatter of about 0.39 mm and 0.38 mm, i.e. three voxels "
            "(build_mri.py --verify). Three further checks agree and none was fitted "
            "for: slice 0 lands on plate 62 and slice 61 on plate 1, consuming the 62 "
            "plates exactly with nothing left over; slice 18, the only slice in the "
            "stack carrying a burned-in mark, is bregma -7.25, which is the atlas's "
            "interaural AP zero (plate 44); and in a mid-sagittal reformat the dorsal "
            "cortical surface sits at DV 0, which is the atlas's own definition of DV "
            "zero. The residual worth knowing about is a small yaw: the per-slice "
            "mirror-symmetry column drifts across the series, so a single ml_zero_px "
            "carries a systematic ML error of a few tenths of a millimetre at the ends.",
    }
    if lo is not None:
        block['display_window'] = [lo, hi]
    if residual:
        block['residual'] = residual
    return block


def frame_axes(plate_frame, mri, w, h):
    """Output pixel centres of a w x h frame image, as MRI column and row coordinates.

    Two Frames composed: plate pixel -> millimetres -> voxel. No arithmetic of its own.
    """
    import numpy as np
    x = (np.arange(w) + 0.5) * (plate_frame.w / w)
    y = (np.arange(h) + 0.5) * (plate_frame.h / h)
    col = np.clip(mri.x(plate_frame.ml(x)), 0, COLS - 1)
    row = np.clip(mri.y(plate_frame.dv(y)), 0, ROWS - 1)
    return col, row


def resample(sl, col, row):
    """One windowed slice, bilinear, onto the (col, row) lattice. Returns uint8."""
    import numpy as np
    c0 = np.floor(col).astype(int)
    c1 = np.minimum(c0 + 1, COLS - 1)
    fc = col - c0
    r0 = np.floor(row).astype(int)
    r1 = np.minimum(r0 + 1, ROWS - 1)
    fr = (row - r0)[:, None]
    top = sl[np.ix_(r0, c0)] * (1 - fc) + sl[np.ix_(r0, c1)] * fc
    bot = sl[np.ix_(r1, c0)] * (1 - fc) + sl[np.ix_(r1, c1)] * fc
    return np.clip((top * (1 - fr) + bot * fr) * 255, 0, 255).astype('uint8')


def jpeg(arr, quality=QUALITY):
    from PIL import Image
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, 'JPEG', quality=quality, optimize=True)
    return buf.getvalue()


def put(path, data, dry):
    if dry:
        print('  would write %-32s %6.1f KB'
              % (os.path.relpath(path, A.ROOT), len(data) / 1024))
        return len(data)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, path)
    return len(data)


def verify(vol, plate_frame, mri, db, span=8):
    """Per-plate residual of brain_outline against the MRI: the map's numeric guard.

    For each plate, the whole-pixel shift that best lines its rings up with the image
    gradient. A correct map leaves those shifts scattered about zero; a drift in any of
    the constants shows up as a trend rather than as scatter.
    """
    import numpy as np
    outline = db['brain_outline']['data']
    rows = []
    for plate in range(1, A.N_PLATES + 1):
        rings = outline.get(str(plate))
        z = slice_of(plate)
        if not rings or not (0 <= z < SLICES):
            continue
        gy, gx = np.gradient(vol[z])
        gm = np.hypot(gy, gx)
        pts = []
        for ring in rings:
            a = np.asarray(ring, float)
            pts.append(np.stack([mri.y(plate_frame.dv_f(a[:, 1])),
                                 mri.x(plate_frame.ml_f(a[:, 0]))], 1))
        if not pts:
            continue
        p = np.concatenate(pts)
        best = None
        for dr in range(-span, span + 1):
            for dc in range(-span, span + 1):
                rr, cc = p[:, 0] + dr, p[:, 1] + dc
                ok = (rr > 1) & (rr < ROWS - 2) & (cc > 1) & (cc < COLS - 2)
                if ok.sum() < 10:
                    continue
                s = gm[np.round(rr[ok]).astype(int), np.round(cc[ok]).astype(int)].mean()
                if best is None or s > best[2]:
                    best = (dr, dc, s)
        if best:
            rows.append((plate, best[0] / mri.dvpx, best[1] / mri.mlpx))
    if not rows:
        return None
    dv = np.array([r[1] for r in rows])
    ml = np.array([r[2] for r in rows])
    return {
        'plates': len(rows),
        'median_dv_mm': round(float(np.median(dv)), 3),
        'median_ml_mm': round(float(np.median(ml)), 3),
        'spread_dv_mm': round(float(np.std(dv)), 3),
        'spread_ml_mm': round(float(np.std(ml)), 3),
        'median_offset_mm': round(float(np.median(np.hypot(dv, ml))), 3),
        'note': 'Whole-pixel shift per plate that best lines brain_outline up with the '
                'image gradient, in millimetres. Written by build_mri.py --verify.',
    }


def build(vol, plate_frame, mri, dry):
    """The 62 plate images and the tile sheet."""
    import numpy as np
    v, lo, hi = window(vol)
    col, row = frame_axes(plate_frame, mri, EMIT_W, EMIT_H)
    total = 0
    for plate in range(1, A.N_PLATES + 1):
        total += put(os.path.join(MRIDIR, '%02d.jpg' % plate),
                     jpeg(resample(v[slice_of(plate)], col, row)), dry)
    print('  %d plate images at %d x %d, %.1f KB'
          % (A.N_PLATES, EMIT_W, EMIT_H, total / 1024))
    sheet_rows = -(-SLICES // SHEET_COLS)
    sheet = np.zeros((sheet_rows * ROWS, SHEET_COLS * COLS), 'uint8')
    for z in range(SLICES):
        r, c = divmod(z, SHEET_COLS)
        sheet[r * ROWS:(r + 1) * ROWS, c * COLS:(c + 1) * COLS] = \
            np.clip(v[z] * 255, 0, 255).astype('uint8')
    n = put(SHEET, jpeg(sheet, 92), dry)
    print('  tile sheet %d x %d (%d x %d slices), %.1f KB'
          % (sheet.shape[1], sheet.shape[0], SHEET_COLS, sheet_rows, n / 1024))
    return lo, hi


def write_frame(db, block, dry):
    """`mri_frame` into the database, next to `plate_frame`.

    Rebuilt rather than assigned so the block lands beside `plate_frame` whichever run
    writes it. Any block already there is dropped, not copied: copying it would let a
    stale one overwrite the new one on a re-run.
    """
    if dry:
        print('  would write mri_frame into data/gerbil_atlas.json')
        return
    out = {}
    for k, v in db.items():
        if k == 'mri_frame':
            continue
        out[k] = v
        if k == 'plate_frame':
            out['mri_frame'] = block
    if 'mri_frame' not in out:
        out['mri_frame'] = block
    A.save_db(out)
    print('  mri_frame written into data/gerbil_atlas.json')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--tif', default=os.environ.get('GERBIL_ATLAS_MRI') or DEFAULT_TIF,
                    help='the source volume ($GERBIL_ATLAS_MRI)')
    ap.add_argument('--dry-run', action='store_true', help='say what would be written')
    ap.add_argument('--verify', action='store_true',
                    help='only re-run the registration check against brain_outline')
    ap.add_argument('--no-frame', action='store_true',
                    help='do not touch data/gerbil_atlas.json')
    a = ap.parse_args()
    if not os.path.exists(a.tif):
        print('%s: not here, nothing to do.\n'
              'The MRI is an optional asset; the app builds and behaves identically '
              'without it.' % a.tif)
        return 0
    db = A.load_db()
    vol, mm = load_tif(a.tif)
    plate_frame = A.Frame(db['plate_frame'])
    mri = A.Frame(mri_frame_block(db, mm))
    print('%s: %d x %d x %d, %.5f mm in plane, %.2f mm between slices'
          % (os.path.basename(a.tif), COLS, ROWS, SLICES, mm,
             db['conventions']['spacing_mm']))
    res = verify(vol, plate_frame, mri, db)
    if res:
        print('  registration: %d plates, median shift DV %+.3f / ML %+.3f mm, '
              'scatter %.3f / %.3f mm'
              % (res['plates'], res['median_dv_mm'], res['median_ml_mm'],
                 res['spread_dv_mm'], res['spread_ml_mm']))
    if a.verify:
        return 0
    lo, hi = build(vol, plate_frame, mri, a.dry_run)
    if not a.no_frame:
        write_frame(db, mri_frame_block(db, mm, lo, hi, res), a.dry_run)
    return 0


if __name__ == '__main__':
    sys.exit(main())
