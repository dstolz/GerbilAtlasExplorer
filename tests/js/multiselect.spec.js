// Ctrl-click adds a region to the selection or takes it out; a plain click starts over.
const { test, expect } = require('./gae');
const path = require('path');

const BUNDLE = 'file://' + path.join(__dirname, '..', '..', 'gerbil_atlas_explorer.html');

/* a point inside each of two outlined regions on the plate, in page pixels, found from the
   extents themselves so the spec does not hard-code where anything is drawn */
async function twoRegions(page, plate) {
  return page.evaluate(pl => {
    const G = window.__gae, b = document.getElementById('iw').getBoundingClientRect();
    const out = [];
    for (const o of G.regBuild(pl).regs) {
      if (o.w || !G.byAb[o.ab] || o.mm2 < 0.3) continue;
      /* a grid point inside it, well clear of a label box, so the click lands on the area */
      let hit = null;
      for (let i = 1; i < 12 && !hit; i++) for (let j = 1; j < 12 && !hit; j++) {
        const x = o.x0 + (o.x1 - o.x0) * i / 12, y = o.y0 + (o.y1 - o.y0) * j / 12;
        if (G.regIn(o, x, y)) hit = [x, y];
      }
      if (hit) out.push({ ab: o.ab, x: b.left + hit[0] / 1100 * b.width, y: b.top + hit[1] / 703 * b.height });
      if (out.length === 2) break;
    }
    return out;
  }, plate);
}

test('Ctrl-click on the plate adds and removes regions; a plain click starts over', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(BUNDLE + '#p30');
  await expect(page.locator('#pn')).toHaveText('Plate 30');
  const [a, b] = await twoRegions(page, 30);
  expect(a && b).toBeTruthy();
  const hit = async (q, mod) => {
    await page.mouse.move(q.x, q.y);
    if (mod) await page.keyboard.down('Control');
    await page.mouse.click(q.x, q.y);
    if (mod) await page.keyboard.up('Control');
  };
  const st = () => page.evaluate(() => window.__gae.state());

  await hit(a, false);
  expect((await st()).sel).toBe(a.ab);
  expect((await st()).msel).toEqual([]);

  await hit(b, true);
  expect((await st()).sel).toBe(a.ab);
  expect((await st()).msel).toEqual([b.ab]);
  await expect(page.locator('#om path')).toHaveCount(2);
  await expect(page.locator('#vinfo')).toContainText('2 selected');
  await page.waitForFunction(ab => location.hash.includes('&ms=' + encodeURIComponent(ab)), b.ab);

  // the link carries both, opened fresh
  const h = await page.evaluate(() => location.hash);
  await page.goto('about:blank');
  await page.goto(BUNDLE + h);
  await expect(page.locator('#om path')).toHaveCount(2);
  expect((await st()).msel).toEqual([b.ab]);

  // taking the first out hands the card to the other
  await hit(a, true);
  expect((await st()).sel).toBe(b.ab);
  expect((await st()).msel).toEqual([]);
  await expect(page.locator('#om path')).toHaveCount(1);

  // add it back, then a plain click starts over
  await hit(a, true);
  expect((await st()).msel).toEqual([a.ab]);
  await hit(a, false);
  expect((await st()).sel).toBe(a.ab);
  expect((await st()).msel).toEqual([]);

  // Ctrl-click the only one selected drops the selection
  await hit(a, true);
  expect((await st()).sel).toBe(null);
  expect(errors).toEqual([]);
});

test('Ctrl-click on a result row adds it without leaving the plate', async ({ page }) => {
  await page.goto(BUNDLE + '#p44/MSO');
  await expect(page.locator('#pn')).toHaveText('Plate 44');
  await page.fill('#q', 'MNTB');
  const row = page.locator('#list .row[data-a="MNTB"]');
  await row.click({ modifiers: ['Control'] });
  const s = await page.evaluate(() => window.__gae.state());
  expect(s.sel).toBe('MSO'); expect(s.msel).toEqual(['MNTB']); expect(s.cur).toBe(44);
  await expect(row).toHaveClass(/\bmsel\b/);
  // the SVG export carries both; its button is in the view's panel, which opens closed
  await page.evaluate(() => window.__gae.vpan(true));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#esvg')]);
  const svg = require('fs').readFileSync(await dl.path(), 'utf8');
  expect(svg).toContain('id="highlight"');
  expect(svg).toContain('class="highlight" data-abbr="MNTB"');
});
