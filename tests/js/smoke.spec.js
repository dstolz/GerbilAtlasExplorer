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

test('the lean page registers its service worker', async ({ page }) => {
  await page.goto(LEAN + '#p30');
  const state = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return r && r.active ? 'active' : 'none';
  });
  expect(state).toBe('active');
});
