// The built pages in a browser: the bundle from disk, the lean page over http.
const { test, expect } = require('@playwright/test');
/* Most of what a view is set by lives in a panel now, and the tuning inside it behind
   Advanced. Both are closed when the page opens, so a spec that drives one of those
   controls says so first. */
const panel = p => p.evaluate(() => window.__gae.vpan(true));
const adv   = p => p.evaluate(() => window.__gae.adv(true));
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
      await expect(page.locator('#vinfo')).toContainText('MSO outlined');
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
      // a pane opens ray-marched, and the toolbar says so
      expect(await page.locator('#m3seg button[data-r="volume"]').getAttribute('class')).toContain('on');
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
  await panel(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#esvg')]);
  const svg = fs.readFileSync(await dl.path(), 'utf8');
  expect((svg.match(/<path /g) || []).length).toBeGreaterThan(44);
  expect(svg).toContain('id="region-Mi"');
});

/* The NIfTI writer, checked on a volume made up for the purpose rather than on the plates:
   what can silently go wrong here is the geometry and the two axis flips, and neither of
   them needs a real stack to catch. Building one takes a minute under swiftshader and the
   test above already waits for one.

   The toolbar button that ran this is out for now; the writer is not, and this is what
   holds it to its header. It is asserted twice over: against the app's own calibration, so
   a recalibration moves the file with it, and against the plate table's printed APs, so it
   cannot move somewhere the atlas does not say. */
test('the NIfTI writer writes an RAS volume at the atlas\u2019s own millimeters', async ({ page }) => {
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
    await expect(page.locator('#vinfo')).toContainText('the ground it lies in belongs to the regions around it');
    expect(await page.evaluate(() => document.querySelectorAll('#om ellipse').length)).toBe(11);
    expect(await page.evaluate(() => document.querySelectorAll('#om path').length)).toBe(0);
    // and the lobule whose white matter that is holds the ground instead
    await page.goto('about:blank');
    await page.goto(BUNDLE + '#p52/Sp5I');
    await expect(page.locator('#vinfo')).toContainText('Sp5I outlined');
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
    await expect(page.locator('#vinfo')).toContainText('no outline of its own to draw');
    await expect(page.locator('#vinfo')).toContainText('mm² of section here');
    expect(await page.evaluate(() => document.querySelectorAll('#om ellipse').length)).toBe(4);
    expect(await page.evaluate(() => document.querySelectorAll('#om path').length)).toBe(0);
  });

/* The atlas letters one hemisphere for some names; the other is named by mirroring. */
test('a name printed on one hemisphere is outlined on both', async ({ page }) => {
  await page.goto(BUNDLE + '#p19/S1J');
  await expect(page.locator('#vinfo')).toContainText('S1J outlined');
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
  // That is the path worth pinning anyway: a refusal must still maximize the page itself.
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
  // the cache is named for the build, and what the page fetches lands in it
  const build = (await page.getAttribute('meta[name="gae-build"]', 'content')).split(' ')[0];
  const cache = await page.evaluate(async () => {
    await (await fetch('LICENSE')).text();
    await new Promise(r => setTimeout(r, 500));
    const names = await caches.keys();
    const c = await caches.open(names[0]);
    return { names, shell: !!(await c.match('index.html')), file: !!(await c.match('LICENSE')) };
  });
  expect(cache.names).toEqual(['gae-' + build]);
  expect(cache.shell).toBe(true);
  expect(cache.file).toBe(true);
});

/* ---------------------------------------------------------------------------
   The layout the controls were moved for. These are the assertions that make
   the move worth having: if the toolbar creeps back up the screen, they fail.
   --------------------------------------------------------------------------- */

test('on a phone the picture is on the first screen in every view', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  for (const [hash, sel, wait] of [['#p30', '#iw', 900], ['#p30&t=proj', '#pjw', 900],
                                   ['#p30&t=v3d', '#v3w', 9000]]) {
    await page.goto(BUNDLE + hash);
    await page.waitForTimeout(wait);
    const bar = await page.evaluate(() =>
      Math.round(document.querySelector('.vbar').getBoundingClientRect().height));
    const g = await page.locator(sel).boundingBox();
    expect(bar, `${hash}: the control bar`).toBeLessThan(110);
    expect(g.y, `${hash}: the top of the picture`).toBeLessThan(200);
    expect(g.width, `${hash}: the picture takes the width`).toBeGreaterThan(380);
    // and nothing hangs off the side at any of them
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(w[0]).toBeLessThanOrEqual(w[1]);
  }
  await ctx.close();
});

test('the controls dock beside the picture, and give the room back', async ({ page }) => {
  // The panel is furniture, not an overlay: it takes a column to the right of the view, so
  // the plate is re-fitted smaller and stays wholly visible rather than being covered. What
  // has to hold is that the re-fit is exact in both directions -- fit() is what keeps the
  // SVG overlays on the image, so a plate left the wrong size is a plate mislabelled.
  await page.goto(BUNDLE + '#p30');
  await page.waitForTimeout(600);
  const before = await page.locator('#iw').boundingBox();
  await page.click('#vctlb');
  await expect(page.locator('#vpan')).toBeVisible();
  const pan = await page.locator('#vpan').boundingBox();
  const open = await page.locator('#iw').boundingBox();
  expect(pan.x).toBeGreaterThanOrEqual(open.x + open.width - 1);   // beside it, not over it
  expect(open.width).toBeLessThan(before.width);                   // and it cost the picture width
  await page.keyboard.press('Escape');             // Escape drops the panel before anything else
  await expect(page.locator('#vpan')).toBeHidden();
  expect(await page.locator('#iw').boundingBox()).toEqual(before); // exactly the size it started
});

test('on a phone the controls take a row above the picture', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(BUNDLE + '#p30');
  await page.waitForTimeout(900);
  const before = await page.locator('#iw').boundingBox();
  await page.click('#vctlb');
  const pan = await page.locator('#vpan').boundingBox();
  const plate = await page.locator('#iw').boundingBox();
  expect(pan.y + pan.height).toBeLessThanOrEqual(plate.y + 2);     // above the picture
  expect(pan.height).toBeLessThanOrEqual(844 * 0.45 + 2);          // and bounded, scrolling inside
  await page.click('#vctlb');
  expect(await page.locator('#iw').boundingBox()).toEqual(before);
  await ctx.close();
});

test('arming a click on the plate leaves the controls where they are', async ({ browser }) => {
  // A docked panel covers nothing, so arming Add no longer has to put it away -- and it
  // should not, or every note would cost you the panel you were working in.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(BUNDLE + '#p30');
  await page.waitForTimeout(900);
  await page.click('#vctlb');
  await page.check('#ckan');
  await page.click('#anadd');                      // arms a click on the plate
  await expect(page.locator('#vpan')).toBeVisible();
  const b = await page.locator('#iw').boundingBox();
  await page.mouse.click(b.x + b.width * 0.45, b.y + b.height * 0.5);
  await expect(page.locator('#anf')).toBeVisible();// and the click still reached the plate
  await ctx.close();
});

test('each view remembers which staining it was left on', async ({ page }) => {
  // The plate and the stack are the same 62 sections seen two ways, and reading one
  // staining flat against another in 3-D is what having both views is for.
  await page.goto(BUNDLE + '#p30');
  await page.waitForTimeout(600);
  await expect(page.locator('#srcseg')).toBeVisible();
  await page.click('#srcseg button[data-s="nissl"]');
  await page.click('#vseg button[data-t="v3d"]');
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
  await expect(page.locator('#srcseg')).toBeVisible();          // offered here too
  expect(await page.evaluate(() => window.__gae.state().psrc)).toBe('nissl');   // its own default
  await page.click('#srcseg button[data-s="myelin"]');
  await page.waitForTimeout(2500);
  await page.click('#vseg button[data-t="plate"]');
  expect(await page.evaluate(() => window.__gae.state().psrc)).toBe('nissl');
  await page.click('#vseg button[data-t="v3d"]');
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => window.__gae.state().psrc)).toBe('myelin');
  // the projection plots where labels are printed, so no staining applies to it
  await page.click('#vseg button[data-t="proj"]');
  expect(await page.locator('#srcseg').isVisible()).toBe(false);
  // both ride in the link, and one written before the stack had its own still sets both
  const h = await page.evaluate(() => { window.__gae.writeHash(); return location.hash; });
  expect(h).toContain('&ps=nissl');
  expect(h).toContain('&ps3=myelin');
  await page.goto(BUNDLE + '#p30&ps=myelin&t=v3d');
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
  expect(await page.evaluate(() => window.__gae.state().psrc)).toBe('myelin');
});

test('the stack opens on the Nissl, and the link stays short about it', async ({ page }) => {
  // Ink stacks into a scribble the march renders as haze; tissue stacks into a brain. So
  // the stack opens on the section and the plate still opens on the drawing, which is the
  // pairing having two views is for.
  await page.goto(BUNDLE + '#p30&t=v3d');
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
  expect(await page.evaluate(() => window.__gae.state().psrc)).toBe('nissl');
  expect(await page.evaluate(() => window.__gae.panes()[0].mode)).toBe('volume');
  await page.evaluate(() => window.__gae.writeHash());
  expect(await page.evaluate(() => location.hash)).toBe('#p30&t=v3d');   // nothing to say
  await page.click('#vseg button[data-t="plate"]');
  expect(await page.evaluate(() => window.__gae.state().psrc)).toBe('drawing');

  // put the stack back on the drawing and the link has to say so, since that is no longer
  // what a link silent about the stack means
  await page.click('#vseg button[data-t="v3d"]');
  await page.waitForTimeout(2500);
  await page.click('#srcseg button[data-s="drawing"]');
  await page.waitForTimeout(2500);
  const h = await page.evaluate(() => { window.__gae.writeHash(); return location.hash; });
  expect(h).toContain('&ps3=drawing');
  expect(h).not.toContain('&ps=');
  await page.goto(BUNDLE + h);
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
  expect(await page.evaluate(() => window.__gae.state().psrc)).toBe('drawing');

  // a plate source alone still names the stack's, the way it did before ps3 existed
  await page.goto(BUNDLE + '#p30&ps=myelin&t=v3d');
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
  expect(await page.evaluate(() => window.__gae.state().psrc)).toBe('myelin');
  // but a plate moved off the drawing while the stack sits on its default is written out
  // in full, since reading ps as both would land the stack somewhere it is not
  await page.goto(BUNDLE + '#p30');
  await page.waitForTimeout(700);
  await page.click('#srcseg button[data-s="myelin"]');
  await page.waitForTimeout(500);
  const h2 = await page.evaluate(() => { window.__gae.writeHash(); return location.hash; });
  expect(h2).toContain('&ps=myelin');
  expect(h2).toContain('&ps3=nissl');
});

test('a finger zooms the plate, and pinching back in fits it', async ({ browser }) => {
  // The -/+/Fit buttons are hidden under 900px because this works. If it stops working
  // there is no way to zoom a plate on a phone at all, so it is pinned here.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(BUNDLE + '#p30');
  await page.waitForTimeout(900);
  expect(await page.locator('.zg').isVisible()).toBe(false);
  const pinch = (a, b) => page.evaluate(([a, b]) => {
    const iw = document.getElementById('iw'), r = iw.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ev = (t, id, x) => iw.dispatchEvent(new PointerEvent(t,
      { pointerId: id, bubbles: true, button: 0, pointerType: 'touch', clientX: x, clientY: cy }));
    ev('pointerdown', 1, cx - a); ev('pointerdown', 2, cx + a);
    for (let i = 1; i <= 8; i++) {
      const d = a + (b - a) * i / 8;
      ev('pointermove', 1, cx - d); ev('pointermove', 2, cx + d);
    }
    ev('pointerup', 1, cx - b); ev('pointerup', 2, cx + b);
  }, [a, b]);
  await pinch(40, 150);
  expect(await page.evaluate(() => window.__gae.state().zoom)).toBeGreaterThan(1.5);
  expect(await page.locator('#iw').getAttribute('class')).toContain('zoomed');
  await pinch(150, 20);                            // and back in, which clamps at exactly 1
  expect(await page.evaluate(() => window.__gae.state().zoom)).toBe(1);
  expect(await page.locator('#iw').getAttribute('class')).not.toContain('zoomed');
  await ctx.close();
});

test('the zoom buttons are there for a mouse', async ({ page }) => {
  await page.goto(BUNDLE + '#p30');
  await expect(page.locator('.zg')).toBeVisible();
  await page.click('#zi');
  expect(await page.evaluate(() => window.__gae.state().zoom)).toBeGreaterThan(1);
  await page.click('#zf');
  expect(await page.evaluate(() => window.__gae.state().zoom)).toBe(1);
});

test('a link that carried tuning opens Advanced to show it', async ({ page }) => {
  // A folded section must never be the unexplained reason the picture looks like that.
  await page.goto(BUNDLE + '#p30&t=v3d&tf=42,20,80,150');
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
  expect(await page.evaluate(() => window.__gae.state().advOn)).toBe(true);
  await page.click('#vctlb');
  await expect(page.locator('#v3gm')).toBeVisible();
  expect(await page.locator('#advn')).toHaveText('1');
  // a bare link leaves it alone
  await page.goto(BUNDLE + '#p30');
  await page.waitForTimeout(600);
  await page.click('#vctlb');
  await expect(page.locator('#advn')).toBeHidden();
});

test('commentary goes behind the mark, a warning stays under the plate', async ({ page }) => {
  await page.goto(BUNDLE + '#p46/MSO');
  await page.waitForTimeout(900);
  await expect(page.locator('#vinfo')).toContainText('MSO outlined');
  await expect(page.locator('#vhint')).toBeHidden();
  await page.click('#vinfb');
  await expect(page.locator('#vinfp')).toBeVisible();
  await expect(page.locator('#vinfp')).toContainText('MSO outlined');
  // off this plate is not commentary: it stays in flow, and so does the way out of it
  await page.goto(BUNDLE + '#p30/MSO');
  await page.waitForTimeout(900);
  await expect(page.locator('#vhint')).toBeVisible();
  await expect(page.locator('#vhint')).toContainText('is not on plate 30');
  await page.click('#oobgo');   // the nearest plate MSO is on, going posterior from 30
  expect(await page.evaluate(() => window.__gae.state().cur)).toBe(44);
});

test('the control strip fits every view on a phone, and never clips a group', async ({ browser }) => {
  // Two failures this guards, both seen for real. A group in the strip used to be allowed to
  // shrink -- flex's default, and .vctl carries min-width:0 -- so the 3-D strip squeezed the
  // source switch from 175px to 108 and .seg's overflow:hidden ate Myelin; a clipped button
  // is not a scrolled one, no gesture brings it back. And the 3-D row was 590px of controls
  // in 368, so the rest was off the right edge with nothing to say so.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  for (const [hash, wait] of [['#p30', 900], ['#p30&t=proj', 900], ['#p30&t=v3d', 0]]) {
    await page.goto(BUNDLE + hash);
    if (wait) await page.waitForTimeout(wait);
    else await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
    const m = await page.evaluate(() => {
      const q = document.querySelector('.vqs');
      return { over: q.scrollWidth - q.clientWidth,
               clipped: [...q.children].filter(el => !el.hidden && el.scrollWidth > el.clientWidth + 1)
                          .map(el => el.id || el.className) };
    });
    expect(m.clipped, `${hash}: no group may be narrower than its contents`).toEqual([]);
    expect(m.over, `${hash}: the strip should need no sideways scroll`).toBe(0);
  }

  // in 3-D the mode is a menu and the source is still a row of buttons: the source is the
  // switch you flip to compare stainings, and that is worth one tap and seeing the choices
  await expect(page.locator('#m3sel')).toBeVisible();
  await expect(page.locator('#m3seg')).toBeHidden();
  const src = await page.locator('#srcseg').boundingBox();
  expect(src.width).toBeGreaterThan(150);
  // the two shapes of the one control cannot drift apart
  expect(await page.evaluate(() => window.__gae.panes()[0].mode)).toBe('volume');
  await page.selectOption('#m3sel', 'contour');
  expect(await page.evaluate(() => window.__gae.panes()[0].mode)).toBe('contour');
  expect(await page.evaluate(() => document.querySelector('#m3seg .on').dataset.r)).toBe('contour');
  // and what did not fit went into the panel rather than off the edge
  const inPanel = s => page.evaluate(x => !!document.getElementById(x).closest('#ctl3d'), s);
  expect(await inPanel('v3vw')).toBe(true);
  expect(await inPanel('v3sp')).toBe(true);
  await ctx.close();
});

test('a strip that does overflow says so until it is scrolled', async ({ browser }) => {
  // Narrower than any phone this targets, purely to exercise the affordance: a touch screen
  // has no scrollbar, so a row that runs past its edge has to fade or nobody knows it does.
  const ctx = await browser.newContext({ viewport: { width: 320, height: 720 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(BUNDLE + '#p30');
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => {
    const q = document.querySelector('.vqs'); return q.scrollWidth > q.clientWidth;
  })).toBe(true);
  await expect(page.locator('.vqs')).toHaveClass(/more/);
  await page.evaluate(() => { const q = document.querySelector('.vqs'); q.scrollLeft = q.scrollWidth; });
  await expect(page.locator('.vqs')).not.toHaveClass(/more/);
  await ctx.close();
});

test('a wide window gets the buttons back, and one row of them', async ({ page }) => {
  await page.goto(BUNDLE + '#p30&t=v3d');
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
  await expect(page.locator('#m3seg')).toBeVisible();
  await expect(page.locator('#m3sel')).toBeHidden();
  expect(await page.evaluate(() => Math.round(document.querySelector('.vbar').getBoundingClientRect().height)))
    .toBeLessThan(60);                                  // one row, not two
});

test('the strip hands what it cannot hold to the panel, and takes it back', async ({ page }) => {
  // Room, not screen size: a 1440 laptop with the sidebar open has not got the width for
  // the viewpoint group, and cutting it off at a silent right edge is how Myelin went
  // missing on a phone. It goes into the panel there and comes back on a wide monitor.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BUNDLE + '#p30&t=v3d');
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
  const where = () => page.evaluate(() =>
    document.getElementById('v3vw').closest('#qs3d') ? 'strip' : 'panel');
  const fits = () => page.evaluate(() => {
    const q = document.querySelector('.vqs'), l = q.getBoundingClientRect().left;
    let w = 0;
    for (const k of q.children) { const r = k.getBoundingClientRect(); if (r.width) w = Math.max(w, r.right - l); }
    return w <= q.clientWidth + 1;
  });
  expect(await where()).toBe('panel');
  expect(await fits()).toBe(true);                      // and nothing is cut to make it fit
  await panel(page);
  await expect(page.locator('#g3cam')).toBeVisible();   // the panel says where it went
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.waitForTimeout(400);
  expect(await where()).toBe('strip');
  expect(await fits()).toBe(true);
  await expect(page.locator('#g3cam')).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  expect(await where()).toBe('panel');                  // and back, without flapping
});
