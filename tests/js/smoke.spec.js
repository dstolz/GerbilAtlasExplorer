// The built pages in a browser: the bundle from disk, the lean page over http.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const BUNDLE = 'file://' + path.join(ROOT, 'gerbil_atlas_explorer.html');
const LEAN = 'http://127.0.0.1:8765/index.html';

for (const [name, url] of [['bundle', BUNDLE], ['lean', LEAN]]) {
  test.describe(name, () => {
    test('loads, searches, selects, deep-links, survives a bad hash', async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(url + '#p30');
      await expect(page.locator('#pn')).toHaveText('Plate 30');
      await page.fill('#q', 'MSO');
      await page.locator('#list .row').first().click();
      await expect(page.locator('#pn')).toHaveText('Plate 44');
      await page.waitForFunction(() => location.hash === '#p44/MSO');   // written after a short debounce
      await page.goto(url + '#p46/MSO&v=rg');
      await expect(page.locator('#vhint')).toContainText('MSO outlined');
      expect(await page.evaluate(() => document.getElementById('ckg').checked)).toBe(true);
      // a bad hash arriving on an open page is ignored; on a fresh load it falls back to plate 30
      await page.goto('about:blank');
      await page.goto(url + '#p999/NOPE/<script>');
      await expect(page.locator('#pn')).toHaveText('Plate 30');
      expect(errors).toEqual([]);
    });

    test('the histology sources swap the image', async ({ page }) => {
      await page.goto(url + '#p30');
      const a = await page.evaluate(() => [document.getElementById('pi').alt, document.getElementById('pi').src.length]);
      await page.click('#srcseg button[data-s="nissl"]');
      const b = await page.evaluate(() => [document.getElementById('pi').alt, document.getElementById('pi').src.length]);
      expect(b[0]).toContain('Nissl');
      expect(a).not.toEqual(b);
      await page.waitForFunction(() => /ps=nissl/.test(location.hash));
    });

    test('projection and 3-D tabs render', async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(url + '#p30/CA1');
      await page.click('#vseg button[data-t="proj"]');
      expect(await page.evaluate(() => document.querySelectorAll('#pjl circle').length)).toBeGreaterThan(0);
      await page.click('#vseg button[data-t="v3d"]');
      await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 60000 });
      await expect(page.locator('#v3nii')).toBeVisible();   // the export appears with the stack
      expect(errors).toEqual([]);
    });

    test('the build stamp is consistent', async ({ page }) => {
      await page.goto(url);
      const meta = await page.getAttribute('meta[name="gae-build"]', 'content');
      expect(meta).toMatch(/^\S+ \S+$/);
      await page.click('#aboutb');
      await expect(page.locator('#about')).toContainText(meta.split(' ')[0]);
    });

    test('a phone-sized window does not scroll sideways', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url + '#p30');
      const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      expect(w[0]).toBeLessThanOrEqual(w[1]);
    });
  });
}

/* The build stamps UTC, because it cannot know where the page will be opened; every
   reader sees that same moment on their own clock, with the zone named. */
test("the Updated stamp is rewritten onto the reader's own clock", async ({ browser }) => {
  const read = async timezoneId => {
    const ctx = await browser.newContext({ timezoneId, locale: 'en-US' });
    const page = await ctx.newPage();
    await page.goto(BUNDLE);
    const out = await page.locator('footer time.bwhen').evaluate(el =>
      ({ text: el.textContent, at: el.getAttribute('datetime'), tip: el.title }));
    out.about = await page.locator('#about time.bwhen').textContent();
    await ctx.close();
    return out;
  };
  const utc = await read('UTC'), tokyo = await read('Asia/Tokyo');
  expect(utc.at).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00Z$/);
  const shown = s => s.slice(0, 10) + ' ' + s.slice(11, 16);
  expect(utc.text).toBe(shown(utc.at) + ' UTC');
  expect(utc.tip).toBe('Built ' + shown(utc.at) + ' UTC');      // the moment as it was stamped
  // nine hours on, the zone named, and About's date follows the same clock
  expect(tokyo.text).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2} [^ ]+$/);
  const back = s => Date.parse(s.slice(0, 10) + 'T' + s.slice(11, 16) + 'Z');
  expect(back(tokyo.text) - Date.parse(utc.at)).toBe(9 * 3600e3);
  expect(tokyo.about).toBe(tokyo.text.slice(0, 10));
});

test('the SVG export carries one named group per region', async ({ page }) => {
  await page.goto(BUNDLE + '#p1/Mi');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#esvg')]);
  const svg = fs.readFileSync(await dl.path(), 'utf8');
  expect((svg.match(/<path /g) || []).length).toBeGreaterThan(44);
  expect(svg).toContain('id="region-Mi"');
});

/* The NIfTI export, checked on a volume made up for the purpose rather than on the plates:
   what can silently go wrong here is the geometry and the two axis flips, and neither of
   them needs a real stack to catch. Building one takes a minute under swiftshader and the
   test above already waits for one.

   The header is asserted twice over: against the app's own calibration, so a recalibration
   moves the file with it, and against the plate table's printed APs, so it cannot move
   somewhere the atlas does not say. */
test('the NIfTI export writes an RAS volume at the atlas\u2019s own millimetres', async ({ page }) => {
  await page.goto(BUNDLE + '#p30');
  const r = await page.evaluate(() => {
    const N = V3W * V3H, nv = N * V3D;
    // a pattern that differs in every voxel of the source, so a wrong index shows
    const pat = (k, y, x, c) => (k * 7 + y * 3 + x * 5 + c * 11) & 255;
    const vol = new Uint8Array(nv * 2);
    for (let k = 0; k < V3D; k++) for (let y = 0; y < V3H; y++) for (let x = 0; x < V3W; x++)
      for (let c = 0; c < 2; c++) vol[(k * N + y * V3W + x) * 2 + c] = pat(k, y, x, c);
    const buf = window.__gae.v3niiBuf(vol, 'drawing'), v = new DataView(buf);
    const out = new Uint8Array(buf, 352);
    // a voxel of the file is the source voxel the (ML, AP up, DV up) mapping names
    let wrong = 0;
    for (const [x, j, l, c] of [[0, 0, 0, 0], [543, 61, 361, 1], [1, 0, 361, 0], [7, 13, 200, 1],
                                [543, 0, 0, 1], [0, 61, 0, 0], [271, 30, 180, 0]])
      if (out[c * nv + x + V3W * (j + V3D * l)] !== pat(V3D - 1 - j, V3H - 1 - l, x, c)) wrong++;
    const f32 = o => v.getFloat32(o, true), i16 = o => v.getInt16(o, true);
    const srow = o => [f32(o), f32(o + 4), f32(o + 8), f32(o + 12)];
    const fx = (V3C[2] - V3C[0]) / V3W, fy = (V3C[3] - V3C[1]) / V3H;
    const one = window.__gae.v3niiBuf(vol, 'nissl');
    return {
      wrong, bytes: buf.byteLength, magic: String.fromCharCode(...new Uint8Array(buf, 344, 3)),
      hdr: v.getInt32(0, true), dim: [0, 1, 2, 3, 4].map(i => i16(40 + i * 2)),
      datatype: i16(70), bitpix: i16(72), voxoff: f32(108), units: v.getUint8(123),
      sform: i16(254), pixdim: [1, 2, 3].map(i => f32(76 + i * 4)),
      x: srow(280), y: srow(296), z: srow(312),
      want: { dx: fx / ML_PXMM, dz: fy / DV_PXMM, dy: 0.35,
              x0: toML(V3C[0] + fx / 2), z0: toDV(V3C[1] + (V3H - 0.5) * fy) },
      ap: [P[V3D - 1].bregma, P[0].bregma], V3W, V3H, V3D,
      // one volume, not two, where the source has no drawn contour to put in a second
      nissl: { dim0: new DataView(one).getInt16(40, true), bytes: one.byteLength },
    };
  });
  expect(r.wrong).toBe(0);
  expect(r.hdr).toBe(348);
  expect(r.magic).toBe('n+1');
  expect(r.datatype).toBe(2);          // uint8
  expect(r.bitpix).toBe(8);
  expect(r.voxoff).toBe(352);
  expect(r.units).toBe(2);             // mm
  expect(r.sform).toBe(1);
  // (ML, AP, DV), with the drawing's two channels as two volumes and nothing else in it
  expect(r.dim).toEqual([4, r.V3W, r.V3D, r.V3H, 2]);
  expect(r.bytes).toBe(352 + r.V3W * r.V3H * r.V3D * 2);
  expect(r.nissl.dim0).toBe(3);
  expect(r.nissl.bytes).toBe(352 + r.V3W * r.V3H * r.V3D);
  // the voxel and the sform are the app's own calibration, not a second copy of it
  const near = (a, b) => expect(a).toBeCloseTo(b, 5);
  near(r.pixdim[0], r.want.dx); near(r.pixdim[1], r.want.dy); near(r.pixdim[2], r.want.dz);
  expect(r.x).toEqual([r.pixdim[0], 0, 0, r.x[3]]);   // diagonal: no rotation, no shear
  expect(r.y).toEqual([0, r.pixdim[1], 0, r.y[3]]);
  expect(r.z).toEqual([0, 0, r.pixdim[2], r.z[3]]);
  near(r.x[3], r.want.x0); near(r.z[3], r.want.z0);
  // and the AP axis runs from the last plate's printed bregma to the first plate's
  near(r.y[3], r.ap[0]);
  near(r.y[3] + (r.V3D - 1) * r.pixdim[1], r.ap[1]);
});

/* The export re-reads the 62 plates, which takes a couple of seconds -- long enough that
   a click with no visible response would read as broken. The button is what the eye is on
   right after the click, so the feedback goes there first: its own label counts the read
   up to 100%, names the two short steps after it, and lands back on itself once the file
   is handed to the browser -- never stuck on a stale percentage or silently re-enabled. */
test('the NIfTI button shows its own progress while the file is written', async ({ page }) => {
  await page.goto(BUNDLE + '#p30&t=v3d');
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 60000 });
  const btn = page.locator('#v3nii');
  await expect(btn).toHaveText('NIfTI');
  await page.evaluate(() => {
    window.__labels = [];
    const b = document.getElementById('v3nii');
    window.__mo = new MutationObserver(() => window.__labels.push(b.textContent));
    window.__mo.observe(b, { childList: true, characterData: true, subtree: true });
  });
  await btn.click();
  await expect(btn).toBeDisabled();
  await expect(btn).not.toHaveText('NIfTI');   // some busy label, before the file is ready
  const dl = await page.waitForEvent('download');
  expect(dl.suggestedFilename()).toBe('gerbil_atlas_stack_drawing.nii.gz');
  const labels = await page.evaluate(() => { window.__mo.disconnect(); return window.__labels; });
  expect(labels[0]).toBe('Reading 0%');
  expect(labels).toContain('Reading 100%');
  expect(labels).toContain('Writing…');
  expect(labels).toContain('Zipping…');
  expect(labels[labels.length - 1]).toBe('NIfTI');
  await expect(btn).toBeEnabled();
});

/* Two different things end in no outline being drawn, and they are encoded differently
   because they are not the same claim. Plate 52 carries one of each, which is why both
   tests below sit on it.

   `cbw` names no region at all -- see `features` -- so it has no entry in `region_extents`
   anywhere, no area, no volume and no mesh. The 11 labels it prints through the cerebellum
   are the whole of what the atlas says about where it is. */
test('a name that is no region has no entry, and highlights the name it prints',
  async ({ page }) => {
    await page.goto(BUNDLE + '#p52');
    const d = await page.evaluate(() => ({
      entry: window.__REGION__.r['52'].cbw === undefined,
      kind: window.__ATLAS__.features.cbw,
      labels: window.__BOX__['52'].cbw.length,
      anywhere: Object.values(window.__REGION__.r).some(b => 'cbw' in b),
    }));
    expect(d).toEqual({ entry: true, kind: 'white matter', labels: 11, anywhere: false });
    // hovering the printed word says what kind of thing it is, and marks that word alone
    const im = await page.locator('#ov').boundingBox();
    const at = await page.evaluate(() => window.__BOX__['52'].cbw[0].slice(0, 2));
    await page.mouse.move(im.x + at[0] * im.width, im.y + at[1] * im.height);
    await expect(page.locator('#tip')).toContainText('the white matter of the lobules it runs through');
    await expect(page.locator('#hl')).toBeVisible();
    await expect(page.locator('#hr')).toBeHidden();
    // selecting it circles every label and outlines nothing. The reload via about:blank
    // is not decoration: goto() to the same URL with a different fragment is a
    // same-document navigation, so the app would never re-read the hash.
    await page.goto('about:blank');
    await page.goto(BUNDLE + '#p52/cbw');
    await expect(page.locator('#vhint')).toContainText('the ground it lies in belongs to the regions around it');
    expect(await page.evaluate(() => document.querySelectorAll('#om ellipse').length)).toBe(11);
    expect(await page.evaluate(() => document.querySelectorAll('#om path').length)).toBe(0);
    // and the lobule whose white matter that is holds the ground instead
    await page.goto('about:blank');
    await page.goto(BUNDLE + '#p52/Sp5I');
    await expect(page.locator('#vhint')).toContainText('Sp5I outlined');
  });

/* `Crus2` on plate 52 is the other case: it *has* ground -- 7.57 mm2 of section, a mesh,
   a share of every track and volume read off it -- but every label of it falls inside a
   bound the atlas draws round more than one name and prints nothing within, so there is no
   boundary of its own to draw. That is `w`, and 309 entries still carry it. */
test('a name the atlas draws no boundary round keeps its area and highlights its labels',
  async ({ page }) => {
    await page.goto(BUNDLE + '#p52');
    const d = await page.evaluate(() => ({
      w: window.__REGION__.r['52'].Crus2.w,
      area: window.__REGION__.r['52'].Crus2.a,
      labels: window.__BOX__['52'].Crus2.length,
    }));
    expect(d.w).toBe(1);
    expect(d.area).toBeGreaterThan(0);          // unlike a name that is no region
    expect(d.labels).toBe(4);
    const im = await page.locator('#ov').boundingBox();
    const at = await page.evaluate(() => window.__BOX__['52'].Crus2[0].slice(0, 2));
    await page.mouse.move(im.x + at[0] * im.width, im.y + at[1] * im.height);
    await expect(page.locator('#tip')).toContainText('draws none of its own here');
    const hr = page.locator('#hr');
    await expect(hr).toHaveClass('lab');
    // one closed rectangle per printed label, and no region outline
    expect(await hr.getAttribute('d')).toMatch(/^(M[\d.]+ [\d.]+H[\d.]+V[\d.]+H[\d.]+Z){4}$/);
    // selecting it circles the labels, and still quotes the area it has
    await page.goto('about:blank');
    await page.goto(BUNDLE + '#p52/Crus2');
    await expect(page.locator('#vhint')).toContainText('no outline of its own to draw');
    await expect(page.locator('#vhint')).toContainText('mm² of section here');
    expect(await page.evaluate(() => document.querySelectorAll('#om ellipse').length)).toBe(4);
    expect(await page.evaluate(() => document.querySelectorAll('#om path').length)).toBe(0);
  });

/* The atlas letters one hemisphere for some names; the other is named by mirroring. */
test('a name printed on one hemisphere is outlined on both', async ({ page }) => {
  await page.goto(BUNDLE + '#p19/S1J');
  await expect(page.locator('#vhint')).toContainText('S1J outlined');
  const sides = await page.evaluate(() => {
    const o = window.__REGION__.r['19'].S1J;
    return [o.n, o.g.length, o.g.map(g => g[0][0] > 0.4727 ? 1 : -1)];
  });
  expect(sides[0]).toBe(1);                    // one printed label
  expect(sides[1]).toBe(2);                    // two hemispheres
  expect(new Set(sides[2]).size).toBe(2);      // one either side of ML 0
});

// A tap is answered by the app's own outline and tooltip, so the platform's tap
// highlight -- a translucent blue box over the whole element -- must be off, and the
// handler must not decode plate images while the finger is still down.
test('a tap on the plate paints no platform highlight and decodes nothing', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BUNDLE + '#p30');
  await page.waitForTimeout(600);
  for (const id of ['iw', 'iw2']) {
    const c = await page.evaluate(i => getComputedStyle(document.getElementById(i)).webkitTapHighlightColor, id);
    expect(c.replace(/\s/g, '')).toBe('rgba(0,0,0,0)');
  }
  await page.evaluate(() => {
    window.__dec = 0;
    const D = Image.prototype.decode;
    Image.prototype.decode = function () { window.__dec++; return D.apply(this, arguments); };
  });
  const b = await page.locator('#iw').boundingBox();
  await page.touchscreen.tap(b.x + b.width * 0.45, b.y + b.height * 0.5);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__gae.state().sel)).toBeTruthy();
  // the card is below the fold on a phone, so no thumbnail is on screen and none is read in
  expect(await page.evaluate(() => window.__dec)).toBe(0);
  await ctx.close();
});

test('the gallery draws only the thumbnails that are on screen', async ({ page }) => {
  await page.goto(BUNDLE + '#p30/CPu');
  await page.waitForTimeout(2000);
  const painted = () => page.evaluate(() => [...document.querySelectorAll('#gal canvas')]
    .filter(c => { const d = c.getContext('2d').getImageData(0, 0, 132, 84).data;
      for (let i = 0; i < d.length; i += 400) if (d[i + 3] > 0) return true; return false; }).length);
  const total = await page.evaluate(() => document.querySelectorAll('#gal .gitem').length);
  const first = await painted();
  expect(total).toBeGreaterThan(4);
  expect(first).toBeGreaterThan(0);
  expect(first).toBeLessThan(total);              // not all of them, only what is visible
  await page.evaluate(() => { const g = document.getElementById('gal'); g.scrollLeft = g.scrollWidth; });
  await page.waitForTimeout(1500);
  expect(await painted()).toBeGreaterThan(first); // scrolling fills the rest in
});

test('maximising hands the whole window to the view, and gives it back', async ({ page }) => {
  // The browser's own fullscreen would resize the viewport under the assertions, and
  // whether it is granted at all is the environment's business -- so it is refused here.
  // That is the path worth pinning anyway: a refusal must still maximise the page itself.
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('refused'));
  });
  await page.goto(BUNDLE + '#p30');
  const plate = () => page.evaluate(() => {
    const b = document.getElementById('iw').getBoundingClientRect();
    return [Math.round(b.width), Math.round(b.height)];
  });
  const before = await plate();
  await page.click('#emax');
  await expect(page.locator('body')).toHaveClass(/maxed/);
  await expect(page.locator('header')).toBeHidden();
  await expect(page.locator('.side')).toBeHidden();
  await expect(page.locator('#vseg')).toBeVisible();          // the view is still driven
  const after = await plate();
  expect(after[0]).toBeGreaterThan(before[0]);                // the room the sidebar had
  // ... and the projection takes it too
  await page.click('#vseg button[data-t="proj"]');
  const wide = await page.evaluate(() => Math.round(document.getElementById('pjw').getBoundingClientRect().width));
  await page.click('#emax');
  await expect(page.locator('body')).not.toHaveClass(/maxed/);
  expect(await page.evaluate(() => Math.round(document.getElementById('pjw').getBoundingClientRect().width)))
    .toBeLessThan(wide);
  // Esc comes back from it, and the plate is exactly the size it started
  await page.click('#vseg button[data-t="plate"]');
  await page.keyboard.press('f');
  await expect(page.locator('body')).toHaveClass(/maxed/);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/maxed/);
  expect(await plate()).toEqual(before);
});

test('the lean page registers its service worker', async ({ page }) => {
  await page.goto(LEAN + '#p30');
  const state = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return r && r.active ? 'active' : 'none';
  });
  expect(state).toBe('active');
});
