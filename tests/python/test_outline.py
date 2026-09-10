"""tools/build_brain_outline.py: the section outline, cut from the drawing.

The tests draw a page rather than read one: a purple section with a red line round it,
a black label printed on its edge with a leader line running out to a word beside it,
and a white ventricle inside. What has to come out is the section and nothing hanging
off it -- no glyph, no leader -- with the ventricle counted as brain; and a boundary
that lies on the traced ink wherever ink is near.
"""
import numpy as np

import build_brain_outline as O

PURPLE = (215, 165, 188)      # the Nissl ground, as the plates print it
RED = (205, 118, 130)         # the drawn line
BLACK = (60, 60, 60)          # a label or a leader line
WHITE = (255, 255, 255)


def page(with_glyph=True, with_leader=True):
    """A 1100 x 703 page: paper, a purple disc with a red rim, a ventricle, and ink."""
    H, W = 703, 1100
    im = np.full((H, W, 3), 255, np.uint8)
    yy, xx = np.mgrid[:H, :W]
    r = np.hypot(xx - 500, yy - 350)
    im[r < 200] = PURPLE
    im[(r >= 196) & (r < 200)] = RED
    im[r < 30] = WHITE                           # a ventricle: a hole, filled back
    if with_glyph:                               # a word printed across the rim, 10 px tall
        im[340:350, 690:720] = BLACK
    if with_leader:                              # a leader line out to a word beside it
        im[349:351, 700:780] = BLACK
        im[335:345, 780:800] = BLACK
    return im


def test_section_is_the_disc_and_the_ventricle_counts():
    m = O.tissue_mask(page(), boxes=[])
    yy, xx = np.mgrid[:703, :1100]
    r = np.hypot(xx - 500, yy - 350)
    assert m[350, 500]                           # the ventricle is brain
    assert m[r < 190].all()                      # the disc is brain
    assert not m[r > 215].any()                  # nothing hangs off it: no leader, no word
    assert not m[335:345, 780:800].any()


def test_a_word_on_the_edge_leaves_no_bump_and_the_snap_takes_the_bite():
    """The black of a word printed across the rim is not in the barrier, so the mask
    carries neither the word's outside half (a bump) nor, past the rim, its inside
    half (a bite deeper than the rim): both stay within the word's own footprint. The
    boundary is then snapped onto the traced line, and lands on it under the word."""
    from scipy import ndimage
    from skimage import measure
    with_ = O.tissue_mask(page(with_glyph=True, with_leader=False), boxes=[])
    without = O.tissue_mask(page(with_glyph=False, with_leader=False), boxes=[])
    diff = with_ ^ without
    yy, xx = np.mgrid[:703, :1100]
    r = np.hypot(xx - 500, yy - 350)
    assert not diff[r > 202].any()                        # no bump
    assert not diff[(r < 188) | (yy < 338) | (yy > 351)].any()   # the bite is the word's
    # the drawn line, as the tracing would carry it: the rim's centreline
    ink = (r >= 197.5) & (r < 198.5)
    dist, idx = ndimage.distance_transform_edt(~ink, return_indices=True)
    m = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]
    (c,) = [c for c in measure.find_contours(with_.astype(np.float32), 0.5) if len(c) > 100]
    out, share = O.snap_ring([(x, y) for y, x in c], m, dist, idx, 1100, 703)
    rr = np.hypot(np.array([q[0] for q in out]) - 500, np.array([q[1] for q in out]) - 350)
    assert share == 1.0 and np.abs(rr - 198).max() < 1.0


def test_keep_rule_keeps_an_island_that_carries_a_label():
    m = np.zeros((703, 1100), bool)
    m[100:400, 100:400] = True                   # the section, 90,000 px
    m[500:530, 800:830] = True                   # an island, 900 px: under 2% of the largest
    m[600:615, 900:915] = True                   # a fleck, 225 px: under FLOOR
    lab, kept, dropped = O.keep_components(m, boxes=[])
    assert len(kept) == 1 and dropped == [(lab[510, 810], 900)]
    lab, kept, dropped = O.keep_components(m, boxes=[[815 / 1100, 515 / 703, 0.01, 0.01]])
    assert len(kept) == 2 and dropped == []      # the label keeps it; the fleck is never kept


def test_snap_lands_on_ink_and_leaves_the_open_flank():
    from scipy import ndimage
    W, H = 400, 300
    ink = np.zeros((H, W), bool)
    ink[100, 50:200] = True                      # a drawn line along y = 100, x in [50, 200)
    dist, idx = ndimage.distance_transform_edt(~ink, return_indices=True)
    m = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]           # page px = plate px, for the test
    ring = [(60, 103), (120, 97), (300, 103)]    # two near the line, one far past its end
    out, share = O.snap_ring(ring, m, dist, idx, W, H)
    assert out[0] == (60.0, 100.0) and out[1] == (120.0, 100.0)
    assert out[2] == (300.0, 103.0)
    assert abs(share - 2 / 3) < 1e-9
