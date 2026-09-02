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

test('the lean page registers its service worker', async ({ page }) => {
  await page.goto(LEAN + '#p30');
  const state = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return r && r.active ? 'active' : 'none';
  });
  expect(state).toBe('active');
});
