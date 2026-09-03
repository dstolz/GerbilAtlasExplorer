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

test('the SVG export carries one named group per region', async ({ page }) => {
  await page.goto(BUNDLE + '#p1/Mi');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#esvg')]);
  const svg = fs.readFileSync(await dl.path(), 'utf8');
  expect((svg.match(/<path /g) || []).length).toBeGreaterThan(44);
  expect(svg).toContain('id="region-Mi"');
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
    // selecting it circles every label and outlines nothing
    await page.goto(BUNDLE + '#p52/cbw');
    await expect(page.locator('#vhint')).toContainText('the ground it lies in belongs to the regions around it');
    expect(await page.evaluate(() => document.querySelectorAll('#om ellipse').length)).toBe(11);
    expect(await page.evaluate(() => document.querySelectorAll('#om path').length)).toBe(0);
    // and the lobule whose white matter that is holds the ground instead
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
