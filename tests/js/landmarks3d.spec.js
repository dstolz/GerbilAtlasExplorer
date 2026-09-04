// Landmarks in the 3-D view: the marks are geometry in the scene and the names ride over
// the canvas as text, so what is checked here is that both appear together, that the
// setting belongs to a pane rather than to the view, and that it rides in the link.
const { test, expect } = require('@playwright/test');
/* the controls these specs drive live in the view's panel, which opens closed */
const panel = p => p.evaluate(() => window.__gae.vpan(true));
const adv   = p => p.evaluate(() => window.__gae.adv(true));

const path = require('path');

const BUNDLE = 'file://' + path.join(__dirname, '..', '..', 'gerbil_atlas_explorer.html');

// the stack is built on first sight of the view and takes a few seconds under swiftshader
async function open(page, hash) {
  await page.goto(BUNDLE + hash);
  await page.waitForFunction(() => window.__gae && v3ready, null, { timeout: 90000 });
}
const panes = page => page.evaluate(() => window.__gae.panes());
const names = page => page.evaluate(() =>
  [...document.querySelectorAll('#v3lw span')].map(s => s.textContent));
// v3render() draws and returns in the one task, so the buffer is still there to read
const shot = page => page.evaluate(() => { v3render(); return document.getElementById('v3c').toDataURL(); });

test('the marks and their names come on together, and change the picture', async ({ page }) => {
  await open(page, '#p30&t=v3d');
  expect(await page.locator('#v3lm').isChecked()).toBe(false);
  expect(await page.locator('#v3lw').isVisible()).toBe(false);
  const off = await shot(page);

  await panel(page); await page.click('#v3lm');
  expect((await panes(page))[0].lm).toBe(true);
  expect(await page.locator('#v3lw').isVisible()).toBe(true);
  // all four are named, and the atlas's own spelling of each is what is written. They come
  // out nearest first, which is the order the collision rule needs and not one to assert.
  expect((await names(page)).sort())
    .toEqual(['bregma', 'interaural', 'lambda', 'occipital crest']);
  expect(await shot(page)).not.toBe(off);

  await panel(page); await page.click('#v3lm');                    // and back off, cleanly
  expect(await page.locator('#v3lw').isVisible()).toBe(false);
  expect(await names(page)).toEqual([]);
});

test('the setting belongs to a pane, and rides in the link', async ({ page }) => {
  await open(page, '#p30&t=v3d');
  await page.click('#v3sp');                    // two panes, both without landmarks
  await page.click('#v3pseg button[data-p="1"]');
  await panel(page); await page.click('#v3lm');
  let p = await panes(page);
  expect(p[0].lm).toBe(false);
  expect(p[1].lm).toBe(true);
  // B alone draws them, so B alone writes names -- four, not eight
  expect((await names(page)).length).toBe(4);

  const h = await page.evaluate(() => { window.__gae.writeHash(); return location.hash; });
  expect(h).toContain('&lm2=1');
  expect(h).not.toContain('&lm=1');

  await page.goto('about:blank');
  await open(page, h);
  p = await panes(page);
  expect(p[0].lm).toBe(false);
  expect(p[1].lm).toBe(true);
  expect(await page.locator('#v3lm').isChecked()).toBe(true);   // the toolbar is on B
  expect(await page.evaluate(() => { window.__gae.writeHash(); return location.hash; })).toBe(h);
});

// The ear-bar axis runs out past the brain to the canals, and Half cuts the scene at the
// midline: the shared line shader has no clip of its own, so it is the geometry that has
// to stop there. A half view that still showed the left ear bar would be the one thing
// about the cut that was not true.
test('the midline cut takes the left half of the ear-bar axis with it', async ({ page }) => {
  await open(page, '#p30&t=v3d&lm=1&vp=rost&or=1');
  const whole = await shot(page);
  await panel(page); await page.click('#v3h');
  expect((await panes(page))[0].half).toBe(true);
  expect(await shot(page)).not.toBe(whole);
});

// The bar goes into the head from outside it. The canals the fit locates sit a fraction of
// a millimeter inside the bone, so an axis that stopped at them would read as a chord
// within the skull rather than as an ear bar through it. What a test can hold of that is
// the reach: it has to clear the widest the fitted skull gets, not just the canals.
test('the ear-bar axis is carried out past the widest bone', async ({ page }) => {
  await open(page, '#p30&t=v3d&lm=1');
  const m = await page.evaluate(() => {
    const S = window.__SKULL__;
    const wide = Math.max(...S.sil.ml.flat().map(p => Math.abs(p[1])));
    return { reach: v3lmReach(S.lm.ear.ml), canal: S.lm.ear.ml, wide };
  });
  expect(m.canal).toBeLessThan(m.wide);          // the canals are inside the bone
  expect(m.reach).toBeGreaterThan(m.wide);       // and the ends of the bar are not
});
